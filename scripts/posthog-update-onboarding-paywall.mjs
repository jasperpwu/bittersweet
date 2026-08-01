#!/usr/bin/env node
// Brings the PostHog dashboard in line with the 2026-07-31 analytics changes:
// the onboarding drop-off funnel, sign-up tracking, and the three-step
// monetization funnel. Companion to scripts/posthog-setup.mjs (same env file,
// same idempotent-by-name approach, token never printed).
//
//   node scripts/posthog-update-onboarding-paywall.mjs           # dry run (default)
//   node scripts/posthog-update-onboarding-paywall.mjs --apply   # write
//
// The key in .posthog.env needs insight:read+write and dashboard:read+write.
//
// What it does:
//   1. CREATE  Onboarding drop-off funnel      (new events)
//   2. CREATE  Sign-ups per day by provider    (new event)
//   3. PATCH   Monetization funnel → 3 steps   (paywall_gate_hit is the new top)
//   4. PATCH   any insight filtering on `during_onboarding` → strip that filter
//
// Step 4 is not cosmetic. `tag_created` no longer carries `during_onboarding` at
// all, and a PostHog `exact false` filter does NOT match events missing the
// property — so any tile still carrying that filter would report zero tags from
// the moment this build ships.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(root, '.posthog.env'), 'utf8');
  } catch {
    fail('Missing .posthog.env — copy .posthog.env.example and fill it in.');
  }
  const env = {};
  for (const line of raw.split('\n')) {
    if (line.trimStart().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = loadEnv();
const HOST = (env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
const KEY = env.POSTHOG_PERSONAL_API_KEY;
if (!KEY || !KEY.startsWith('phx_')) fail('POSTHOG_PERSONAL_API_KEY missing or not a phx_ key.');

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(method, path, body) {
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

// --- Query builders (mirror scripts/posthog-setup.mjs) ---
const evt = (event, extra = {}) => ({ kind: 'EventsNode', event, name: event, ...extra });
const prop = (key, value) => ({ key, value: [value], operator: 'exact', type: 'event' });
const step = (event, key, value) => evt(event, { properties: [prop(key, value)] });

const funnel = (series, { interval = 1, unit = 'hour', exclusions } = {}) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'FunnelsQuery',
    dateRange: { date_from: '-30d' },
    series,
    funnelsFilter: {
      funnelWindowInterval: interval,
      funnelWindowIntervalUnit: unit,
      ...(exclusions ? { exclusions } : {}),
    },
  },
});

const trends = (series, opts = {}) => ({
  kind: 'InsightVizNode',
  source: { kind: 'TrendsQuery', dateRange: { date_from: '-30d' }, series, ...opts },
});

// Onboarding is one sitting, so a 1-hour window: a longer one would count
// "started Monday, finished Friday" as a success and hide real abandonment.
// The three step_viewed steps share an event and differ only by step_name.
//
// Excluded: users who signed in to an EXISTING account mid-onboarding. They are
// sent straight to the app and never fire onboarding_completed, so without this
// they read as abandonment when they actually finished onboarding long ago on
// another device. A funnel exclusion drops anyone who fires the event anywhere
// between the first and last step.
const ONBOARDING_FUNNEL = funnel(
  [
    step('onboarding_step_viewed', 'step_name', 'premise'),
    step('onboarding_step_viewed', 'step_name', 'tag_picker'),
    step('onboarding_step_viewed', 'step_name', 'goal_picker'),
    evt('onboarding_completed'),
  ],
  {
    exclusions: [
      {
        kind: 'EventsNode',
        event: 'onboarding_signed_in',
        name: 'onboarding_signed_in',
        properties: [prop('existing_account', 'true')],
        funnelFromStep: 0,
        funnelToStep: 3,
      },
    ],
  }
);

// Purchase decisions span sessions, so 3 days (matches the old tile 15 window).
const MONETIZATION_FUNNEL = funnel(
  [evt('paywall_gate_hit'), evt('paywall_viewed'), evt('subscription_started')],
  { interval: 3, unit: 'day' }
);

// Each person signs up exactly once, so daily uniques == sign-ups that day.
const SIGNUPS = trends([evt('signed_up', { math: 'dau' })], {
  breakdownFilter: { breakdown_type: 'event', breakdown: 'provider' },
});

// Recursively drop every `during_onboarding` property filter from a query tree.
function stripDuringOnboarding(node) {
  let removed = 0;
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (k === 'properties' && Array.isArray(v)) {
        const kept = v.filter((p) => p?.key !== 'during_onboarding');
        removed += v.length - kept.length;
        n[k] = kept;
        kept.forEach(walk);
        continue;
      }
      walk(v);
    }
  };
  walk(node);
  return removed;
}

async function main() {
  const pid = env.POSTHOG_PROJECT_ID || (await api('GET', '/api/projects/')).results?.[0]?.id;
  if (!pid) fail('No project visible to this key.');
  const base = `/api/projects/${pid}`;
  console.log(`\n📊 Project ${pid} @ ${HOST}${APPLY ? '' : '   (DRY RUN — pass --apply to write)'}\n`);

  // Target the analytics dashboard by id, falling back to a name match. Never
  // fall back to "the first dashboard" — the project also has an unrelated
  // "My App Dashboard", and an earlier run silently created tiles on it.
  const dashboards = await api('GET', `${base}/dashboards/?limit=100`);
  const wanted = env.POSTHOG_DASHBOARD_ID || '1734418';
  const dash =
    (dashboards.results || []).find((d) => String(d.id) === String(wanted)) ||
    (dashboards.results || []).find((d) => /core analytics/i.test(d.name));
  if (!dash) fail(`Dashboard ${wanted} not found. Set POSTHOG_DASHBOARD_ID in .posthog.env.`);
  console.log(`Dashboard #${dash.id}: ${dash.name}`);

  const full = await api('GET', `${base}/dashboards/${dash.id}/`);
  const tiles = (full.tiles || []).filter((t) => t.insight);
  console.log(`${tiles.length} insight tiles\n`);

  const byName = (re) => tiles.map((t) => t.insight).find((i) => re.test(i.name || ''));

  // 1 + 2 — create the new tiles (skip if a tile with that name already exists).
  // 30 is already taken by "Suggested focus-rating distribution".
  const creations = [
    ['31 · Onboarding drop-off funnel', ONBOARDING_FUNNEL],
    ['32 · Sign-ups per day by provider', SIGNUPS],
  ];
  for (const [name, query] of creations) {
    const existing = byName(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    // Upsert, not skip: the definitions here are the source of truth, so a
    // re-run after editing one (e.g. adding a funnel exclusion) applies it.
    if (existing) {
      if (!APPLY) {
        console.log(`✎ PATCH   #${existing.id}  ${name}`);
        continue;
      }
      await api('PATCH', `${base}/insights/${existing.id}/`, { query });
      console.log(`✅ PATCH   #${existing.id}  ${name}`);
      continue;
    }
    if (!APPLY) {
      console.log(`＋ CREATE  ${name}`);
      continue;
    }
    const created = await api('POST', `${base}/insights/`, {
      name,
      query,
      dashboards: [dash.id],
    });
    console.log(`✅ CREATE  #${created.id}  ${name}`);
  }

  // 3 — the monetization funnel gains paywall_gate_hit as its true first step.
  const monetization = byName(/monetization funnel/i);
  if (!monetization) {
    console.log('⚠️  SKIP    no "Monetization funnel" tile found — nothing patched');
  } else if (!APPLY) {
    console.log(`✎ PATCH   #${monetization.id}  ${monetization.name} → 3-step funnel`);
  } else {
    await api('PATCH', `${base}/insights/${monetization.id}/`, { query: MONETIZATION_FUNNEL });
    console.log(`✅ PATCH   #${monetization.id}  ${monetization.name} → 3-step funnel`);
  }

  // 4 — strip the now-dead during_onboarding filter wherever it survives.
  for (const tile of tiles) {
    const insight = tile.insight;
    if (!insight.query) continue;
    const query = JSON.parse(JSON.stringify(insight.query));
    const removed = stripDuringOnboarding(query);
    if (!removed) continue;
    if (!APPLY) {
      console.log(`✎ PATCH   #${insight.id}  ${insight.name} — drop ${removed} during_onboarding filter(s)`);
      continue;
    }
    await api('PATCH', `${base}/insights/${insight.id}/`, { query });
    console.log(`✅ PATCH   #${insight.id}  ${insight.name} — dropped ${removed} during_onboarding filter(s)`);
  }

  console.log(
    `\n${APPLY ? '🎉 Done' : '🔍 Dry run complete'}. Open: ${HOST}${base}/dashboard/${dash.id}\n`
  );
}

main().catch((e) => fail(e.message));
