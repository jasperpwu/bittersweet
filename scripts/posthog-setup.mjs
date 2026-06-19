#!/usr/bin/env node
// One-off PostHog setup for Milestone 1: creates cohorts, insights, and a dashboard
// via the PostHog API. Reads a SCOPED personal API key from .posthog.env (gitignored)
// — the token is never printed.
//
// Idempotent: objects are matched by name and reused if they already exist, so it's
// safe to re-run (e.g. after fixing a payload) without creating duplicates.
//
//   node scripts/posthog-setup.mjs
//
// See docs/analytics-plan.md for the chart spec this mirrors.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

// --- Load .posthog.env (simple KEY=VALUE parser; no dependency) ---
function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(root, '.posthog.env'), 'utf8');
  } catch {
    fail('Missing .posthog.env — copy .posthog.env.example to .posthog.env and fill it in.');
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
if (!KEY || !KEY.startsWith('phx_')) {
  fail('POSTHOG_PERSONAL_API_KEY missing or not a personal API key (should start with phx_).');
}

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
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

// Find an existing object by exact name, else create it (idempotent).
async function ensure(label, listPath, name, body, useSearch) {
  const q = useSearch ? `?search=${encodeURIComponent(name)}&limit=100` : `?limit=200`;
  const list = await api('GET', `${listPath}${q}`);
  const existing = (list.results || []).find((r) => r.name === name);
  if (existing) {
    console.log(`↩︎  ${label} exists #${existing.id}: ${name}`);
    return existing;
  }
  const created = await api('POST', listPath, { ...body, name });
  console.log(`✅ ${label} #${created.id}: ${name}`);
  return created;
}

async function resolveProjectId() {
  if (env.POSTHOG_PROJECT_ID) return env.POSTHOG_PROJECT_ID;
  const projects = await api('GET', '/api/projects/');
  const results = projects.results || [];
  if (results.length === 0) fail('No projects visible to this key. Grant it project read scope.');
  return results[0].id;
}

// --- Query builders (modern `query` schema: InsightVizNode + *Query) ---
const evt = (event, extra = {}) => ({ kind: 'EventsNode', event, name: event, ...extra });
const last30 = { date_from: '-30d' };

const M1_EVENTS = [
  'onboarding_completed',
  'focus_session_completed',
  'blocklist_configured',
  'app_unlocked',
  'goal_activated',
  'store_opened',
  'widget_active',
];

const trends = (series, opts = {}) => ({
  kind: 'InsightVizNode',
  source: { kind: 'TrendsQuery', dateRange: last30, series, ...opts },
});

const retention = (cohortId) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'RetentionQuery',
    retentionFilter: {
      targetEntity: { id: 'focus_session_completed', name: 'focus_session_completed', type: 'events' },
      returningEntity: { id: 'focus_session_completed', name: 'focus_session_completed', type: 'events' },
      retentionType: 'retention_first_time',
      period: 'Week',
      totalIntervals: 8,
    },
    // properties is a FLAT array of property filters (not a group object).
    ...(cohortId ? { properties: [{ type: 'cohort', key: 'id', value: cohortId }] } : {}),
  },
});

const funnel = () => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'FunnelsQuery',
    dateRange: last30,
    series: [evt('Application Opened'), evt('onboarding_completed'), evt('focus_session_completed')],
    funnelsFilter: { funnelWindowInterval: 7, funnelWindowIntervalUnit: 'day' },
  },
});

const stickiness = () => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'StickinessQuery',
    dateRange: last30,
    series: [evt('Application Opened', { math: 'dau' })],
    stickinessFilter: {},
  },
});

// Cohorts: sticky true-only flags → is_set / is_not_set
const personFlag = (key, isSet) => ({
  filters: {
    properties: {
      type: 'OR',
      values: [
        {
          type: 'AND',
          values: [{ type: 'person', key, operator: isSet ? 'is_set' : 'is_not_set', value: isSet ? 'is_set' : 'is_not_set' }],
        },
      ],
    },
  },
});

async function main() {
  const pid = await resolveProjectId();
  console.log(`\n📊 Project ${pid} @ ${HOST}\n`);
  const base = `/api/projects/${pid}`;

  const dashboard = await ensure('Dashboard', `${base}/dashboards/`, 'Milestone 1 — Core Analytics', {
    description: 'Feature adoption, retention, and cohorts. Auto-created by scripts/posthog-setup.mjs.',
  });

  const cohortDefs = [
    ['Blockers', 'ever_configured_blocklist', true],
    ['Non-blockers', 'ever_configured_blocklist', false],
    ['Goal setters', 'has_set_goal', true],
    ['Non-goal-setters', 'has_set_goal', false],
    ['Widget users', 'has_active_widget', true],
    ['Non-widget users', 'has_active_widget', false],
  ];
  const cohorts = {};
  for (const [name, key, isSet] of cohortDefs) {
    const c = await ensure('Cohort', `${base}/cohorts/`, name, personFlag(key, isSet), false);
    cohorts[name] = c.id;
  }

  const insights = [
    ['1 · Feature adoption (unique users, 30d)', trends(M1_EVENTS.map((e) => evt(e, { math: 'dau' })), { trendsFilter: { display: 'ActionsBar' } })],
    ['2 · Retention — core loop (weekly)', retention(null)],
    ['3a · Retention — Blockers', retention(cohorts['Blockers'])],
    ['3b · Retention — Non-blockers', retention(cohorts['Non-blockers'])],
    ['4a · Retention — Goal setters', retention(cohorts['Goal setters'])],
    ['4b · Retention — Non-goal-setters', retention(cohorts['Non-goal-setters'])],
    ['5a · Retention — Widget users', retention(cohorts['Widget users'])],
    ['5b · Retention — Non-widget users', retention(cohorts['Non-widget users'])],
    ['6 · DAU / WAU / MAU', trends([
      evt('Application Opened', { math: 'dau' }),
      evt('Application Opened', { math: 'weekly_active' }),
      evt('Application Opened', { math: 'monthly_active' }),
    ])],
    ['6b · Stickiness (DAU/MAU)', stickiness()],
    ['Bonus · Activation funnel', funnel()],
  ];
  for (const [name, query] of insights) {
    await ensure('Insight', `${base}/insights/`, name, { query, dashboards: [dashboard.id] }, true);
  }

  console.log(`\n🎉 Done. Open: ${HOST}${base}/dashboard/${dashboard.id}\n`);
}

main().catch((e) => fail(e.message));
