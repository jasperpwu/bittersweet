// Supabase Edge Function: reengagement-cron
// Re-engages users who have stopped opening the app. Runs hourly (pg_cron, see
// 20260708_reengagement.sql). For each quiet user whose LOCAL time is ~10am and
// who has crossed an inactivity tier (2d / 5d / 14d, then every 14d), it picks a
// feature they haven't used yet and pushes a localized nudge that deep-links
// straight there. If every feature is used, it falls back to a "come focus"
// welcome-back or a "share a suggestion" nudge.
//
// No auth (service role, internal). Invoked by the cron; safe to call manually
// to test: supabase functions invoke reengagement-cron --no-verify-jwt
//
// Deployment: supabase functions deploy reengagement-cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SEND_HOUR = 10; // deliver around 10am local time

// ⚠️ TEST OVERRIDE — remove before GA. For this one user the tiers are measured
// in HOURS instead of days (2h / 5h / 14h) and the 10am-local gate is skipped,
// so nudges fire on the next hourly cron run for fast end-to-end testing.
const TEST_USER_ID = '9c931ba0-39e9-4597-b691-4b941b0c7118';
function tierConfig(userId: string): { unit: number; gateLocalHour: boolean } {
  if (userId === TEST_USER_ID) return { unit: HOUR_MS, gateLocalHour: false };
  return { unit: DAY_MS, gateLocalHour: true };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secondary features we rotate through (existence in these tables = "used").
// Order is irrelevant — one unused feature is picked at random per user.
const FEATURES = ['goals', 'todos', 'grove', 'store', 'blocklist', 'health'] as const;
type Feature = (typeof FEATURES)[number];
// Fallbacks when the user has already used everything.
type Promo = Feature | 'focus' | 'suggest';

type Lang = 'en' | 'de' | 'es' | 'fr' | 'ja' | 'ko' | 'pt-BR' | 'zh-Hans';
const LANGS: Lang[] = ['en', 'de', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'zh-Hans'];

// Push copy per promo × language. "Grove" is a product proper noun kept
// untranslated everywhere (matches the app's own locale files). Kept in the
// function (not app i18n) because a remote push must carry its own text — the
// app isn't running to localize it.
const COPY: Record<Promo, Record<Lang, { title: string; body: string }>> = {
  goals: {
    en: { title: 'Set a focus goal 🎯', body: "Give your focus some direction — set a weekly goal and build a streak." },
    de: { title: 'Setz dir ein Fokusziel 🎯', body: 'Gib deinem Fokus eine Richtung – setz dir ein Wochenziel und bau eine Serie auf.' },
    es: { title: 'Fíjate una meta de enfoque 🎯', body: 'Dale rumbo a tu concentración: fija una meta semanal y crea una racha.' },
    fr: { title: 'Fixe-toi un objectif de focus 🎯', body: 'Donne une direction à ta concentration : fixe un objectif hebdo et lance une série.' },
    ja: { title: '集中の目標を決めよう 🎯', body: '集中に方向性を。週の目標を立てて連続記録をのばそう。' },
    ko: { title: '집중 목표를 세워보세요 🎯', body: '집중에 방향을 더하세요. 주간 목표를 정하고 연속 기록을 쌓아보세요.' },
    'pt-BR': { title: 'Defina uma meta de foco 🎯', body: 'Dê rumo à sua concentração: defina uma meta semanal e crie uma sequência.' },
    'zh-Hans': { title: '设定一个专注目标 🎯', body: '给专注一个方向——设定每周目标，积累连续记录。' },
  },
  todos: {
    en: { title: 'Plan your next session 📝', body: "Add a few to-dos and check them off during your next focus session." },
    de: { title: 'Plane deine nächste Session 📝', body: 'Füg ein paar Aufgaben hinzu und hak sie in deiner nächsten Fokus-Session ab.' },
    es: { title: 'Planifica tu próxima sesión 📝', body: 'Añade algunas tareas y márcalas durante tu próxima sesión de enfoque.' },
    fr: { title: 'Prépare ta prochaine session 📝', body: 'Ajoute quelques tâches et coche-les pendant ta prochaine session de focus.' },
    ja: { title: '次のセッションを計画しよう 📝', body: 'やることをいくつか追加して、次の集中セッションで片づけよう。' },
    ko: { title: '다음 세션을 계획해보세요 📝', body: '할 일을 몇 개 추가하고 다음 집중 세션에서 하나씩 완료해보세요.' },
    'pt-BR': { title: 'Planeje sua próxima sessão 📝', body: 'Adicione algumas tarefas e marque-as durante sua próxima sessão de foco.' },
    'zh-Hans': { title: '规划你的下一次专注 📝', body: '添加几项待办，在下一次专注中逐一完成。' },
  },
  grove: {
    en: { title: 'Grow your Grove 🌳', body: "Add a friend and keep each other focused. Your Grove is waiting for you." },
    de: { title: 'Lass deinen Grove wachsen 🌳', body: 'Füg einen Freund hinzu und bleibt gemeinsam fokussiert. Dein Grove wartet auf dich.' },
    es: { title: 'Haz crecer tu Grove 🌳', body: 'Añade a un amigo y manteneos concentrados. Tu Grove te espera.' },
    fr: { title: 'Fais grandir ton Grove 🌳', body: 'Ajoute un ami et restez concentrés ensemble. Ton Grove t’attend.' },
    ja: { title: 'Grove を育てよう 🌳', body: '友だちを追加して、一緒に集中を続けよう。あなたの Grove が待っています。' },
    ko: { title: 'Grove를 키워보세요 🌳', body: '친구를 추가하고 서로 집중을 이어가세요. Grove가 당신을 기다리고 있어요.' },
    'pt-BR': { title: 'Faça seu Grove crescer 🌳', body: 'Adicione um amigo e mantenham o foco juntos. Seu Grove está esperando por você.' },
    'zh-Hans': { title: '培育你的 Grove 🌳', body: '添加好友，一起保持专注。你的 Grove 正在等你。' },
  },
  store: {
    en: { title: 'Treat yourself 🍎', body: "You've earned fruits — spend them on a reward or a fresh theme in the Store." },
    de: { title: 'Belohn dich 🍎', body: 'Du hast Früchte gesammelt – gib sie im Shop für eine Belohnung oder ein neues Design aus.' },
    es: { title: 'Date un capricho 🍎', body: 'Has ganado frutas: gástalas en una recompensa o un tema nuevo en la Tienda.' },
    fr: { title: 'Fais-toi plaisir 🍎', body: 'Tu as gagné des fruits : dépense-les pour une récompense ou un nouveau thème dans la Boutique.' },
    ja: { title: '自分にごほうびを 🍎', body: 'フルーツが貯まっています。ストアでごほうびや新しいテーマに使ってみよう。' },
    ko: { title: '나를 위한 선물 🍎', body: '과일을 모았어요. 스토어에서 보상이나 새로운 테마에 사용해보세요.' },
    'pt-BR': { title: 'Dê um mimo a você 🍎', body: 'Você ganhou frutas — use-as em uma recompensa ou um tema novo na Loja.' },
    'zh-Hans': { title: '犒赏一下自己 🍎', body: '你已经攒下了水果——在商店里兑换奖励或全新主题吧。' },
  },
  blocklist: {
    en: { title: 'Silence the distractions 🛡️', body: 'Pick the apps to block during focus and stay in the zone.' },
    de: { title: 'Bring Ablenkungen zum Schweigen 🛡️', body: 'Wähl die Apps, die beim Fokus blockiert werden, und bleib in der Zone.' },
    es: { title: 'Silencia las distracciones 🛡️', body: 'Elige qué apps bloquear durante el enfoque y no pierdas el ritmo.' },
    fr: { title: 'Fais taire les distractions 🛡️', body: 'Choisis les applis à bloquer pendant le focus et reste dans le rythme.' },
    ja: { title: '気が散るアプリをブロック 🛡️', body: '集中中にブロックするアプリを選んで、ゾーンに入り続けよう。' },
    ko: { title: '방해 요소를 차단하세요 🛡️', body: '집중하는 동안 차단할 앱을 골라 몰입을 유지하세요.' },
    'pt-BR': { title: 'Silencie as distrações 🛡️', body: 'Escolha os apps para bloquear durante o foco e mantenha o ritmo.' },
    'zh-Hans': { title: '屏蔽干扰 🛡️', body: '选择专注时要屏蔽的应用，保持心流状态。' },
  },
  health: {
    en: { title: 'Connect Apple Health ❤️', body: 'Log your focus time as mindful minutes by linking Apple Health.' },
    de: { title: 'Apple Health verbinden ❤️', body: 'Erfasse deine Fokuszeit als achtsame Minuten – verbinde Apple Health.' },
    es: { title: 'Conecta Apple Health ❤️', body: 'Registra tu tiempo de enfoque como minutos de mindfulness enlazando Apple Health.' },
    fr: { title: 'Connecte Apple Health ❤️', body: 'Enregistre ton temps de focus en minutes de pleine conscience en liant Apple Health.' },
    ja: { title: 'Apple Health と連携 ❤️', body: 'Apple Health と連携して、集中時間をマインドフルな時間として記録しよう。' },
    ko: { title: 'Apple Health 연결 ❤️', body: 'Apple Health를 연결해 집중 시간을 마음챙김 시간으로 기록하세요.' },
    'pt-BR': { title: 'Conecte o Apple Health ❤️', body: 'Registre seu tempo de foco como minutos de atenção plena conectando o Apple Health.' },
    'zh-Hans': { title: '连接 Apple 健康 ❤️', body: '连接 Apple 健康，把专注时间记录为正念时刻。' },
  },
  focus: {
    en: { title: 'Your Grove misses you 🌱', body: "It's been a while. Start a quick focus session and pick up where you left off." },
    de: { title: 'Dein Grove vermisst dich 🌱', body: 'Es ist eine Weile her. Starte eine kurze Fokus-Session und mach da weiter, wo du aufgehört hast.' },
    es: { title: 'Tu Grove te echa de menos 🌱', body: 'Ha pasado un tiempo. Empieza una sesión rápida y retoma donde lo dejaste.' },
    fr: { title: 'Ton Grove t’attend 🌱', body: 'Ça fait un moment. Lance une petite session de focus et reprends où tu t’étais arrêté.' },
    ja: { title: 'あなたの Grove が待っています 🌱', body: 'しばらくぶりですね。短い集中セッションを始めて、続きからいきましょう。' },
    ko: { title: 'Grove가 당신을 기다려요 🌱', body: '오랜만이에요. 짧은 집중 세션을 시작하고 멈춘 곳부터 이어가요.' },
    'pt-BR': { title: 'Seu Grove sente sua falta 🌱', body: 'Faz um tempo. Comece uma sessão rápida de foco e continue de onde parou.' },
    'zh-Hans': { title: '你的 Grove 想你了 🌱', body: '有段时间没见了。开始一次简短的专注，从上次停下的地方继续吧。' },
  },
  suggest: {
    en: { title: 'Help shape Bittersweet 💡', body: 'What would make Bittersweet better for you? Tap to tell us — we’re listening.' },
    de: { title: 'Gestalte Bittersweet mit 💡', body: 'Was würde Bittersweet für dich besser machen? Tipp und sag es uns – wir hören zu.' },
    es: { title: 'Ayuda a mejorar Bittersweet 💡', body: '¿Qué haría mejor a Bittersweet para ti? Toca y cuéntanos: te escuchamos.' },
    fr: { title: 'Aide à façonner Bittersweet 💡', body: 'Qu’est-ce qui rendrait Bittersweet meilleur pour toi ? Touche pour nous le dire — on t’écoute.' },
    ja: { title: 'Bittersweet を一緒に育てよう 💡', body: 'どうすれば Bittersweet がもっと良くなる？タップして教えてください。お待ちしています。' },
    ko: { title: 'Bittersweet를 함께 만들어요 💡', body: 'Bittersweet가 어떻게 더 나아지면 좋을까요? 탭해서 알려주세요. 귀 기울이고 있어요.' },
    'pt-BR': { title: 'Ajude a moldar o Bittersweet 💡', body: 'O que tornaria o Bittersweet melhor para você? Toque e conte — estamos ouvindo.' },
    'zh-Hans': { title: '一起打造 Bittersweet 💡', body: '怎样能让 Bittersweet 对你更好用？点一下告诉我们，我们在倾听。' },
  },
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeLang(raw: string | null | undefined): Lang {
  if (raw && (LANGS as string[]).includes(raw)) return raw as Lang;
  // Tolerate region variants like "pt", "zh", "en-US".
  if (raw?.startsWith('pt')) return 'pt-BR';
  if (raw?.startsWith('zh')) return 'zh-Hans';
  const base = raw?.split('-')[0];
  if (base && (LANGS as string[]).includes(base)) return base as Lang;
  return 'en';
}

// User's local hour (0-23) for the given IANA timezone; falls back to UTC when
// the timezone is missing or unparseable.
function localHour(timezone: string | null): number {
  const now = new Date();
  if (!timezone) return now.getUTCHours();
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(now);
    const h = parseInt(s, 10);
    if (Number.isNaN(h)) return now.getUTCHours();
    return h === 24 ? 0 : h; // some runtimes render midnight as "24"
  } catch {
    return now.getUTCHours();
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// The tier LEVEL to send now (2 / 5 / 14 units of inactivity), or null. Unit-
// agnostic so day- and hour-scale users share the logic; the caller turns the
// level into a label like '5d'/'5h'. A prior nudge counts toward the CURRENT
// streak only if it was sent after the user's last activity (otherwise the user
// returned and left again — a fresh streak). last_tier is stored as e.g. '14d',
// so its leading integer is the previously-sent level.
function tierToSend(
  inactiveUnits: number,
  lastActiveMs: number,
  state: { last_nudge_at: string | null; last_tier: string | null } | undefined,
  nowMs: number,
  unitMs: number
): 2 | 5 | 14 | null {
  const level = inactiveUnits >= 14 ? 14 : inactiveUnits >= 5 ? 5 : inactiveUnits >= 2 ? 2 : null;
  if (!level) return null;

  const lastNudgeMs = state?.last_nudge_at ? new Date(state.last_nudge_at).getTime() : 0;
  const streakActive = lastNudgeMs > lastActiveMs;
  const sentLevel = streakActive && state?.last_tier ? parseInt(state.last_tier, 10) || 0 : 0;

  if (level === 2) return sentLevel === 0 ? 2 : null;
  if (level === 5) return sentLevel < 5 ? 5 : null; // sent nothing or only the 2-tier
  // 14-tier: send once when escalating into it, then repeat every 14 units.
  if (sentLevel < 14) return 14;
  return nowMs - lastNudgeMs >= 14 * unitMs ? 14 : null;
}

// Distinct user_ids present in `table` (optionally filtered), among `ids`.
async function usersWithRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  ids: string[],
  refine?: (q: any) => any
): Promise<Set<string>> {
  const set = new Set<string>();
  for (const c of chunk(ids, 500)) {
    let q = supabase.from(table).select('user_id').in('user_id', c);
    if (refine) q = refine(q);
    const { data, error } = await q;
    if (error) {
      console.error(`usersWithRows(${table}) error:`, error.message);
      continue;
    }
    (data ?? []).forEach((r: { user_id: string }) => set.add(r.user_id));
  }
  return set;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const nowMs = Date.now();
    const twoDaysAgoIso = new Date(nowMs - 2 * DAY_MS).toISOString();

    // 1. Quiet users (no activity for 2+ days).
    const { data: quiet, error: quietError } = await supabase
      .from('user_activity')
      .select('user_id, last_active_at, timezone')
      .lt('last_active_at', twoDaysAgoIso)
      .limit(20000);

    if (quietError) {
      console.error('user_activity fetch error:', quietError.message);
      return jsonResponse({ error: 'activity_fetch_failed' }, 500);
    }

    const candidates = quiet ?? [];

    // ⚠️ TEST OVERRIDE — remove before GA. The test user runs on hour-scale
    // tiers, so the 2-day query above misses them; pull their row separately
    // once they've been idle 2+ hours and fold it in (deduped).
    const { data: testRow } = await supabase
      .from('user_activity')
      .select('user_id, last_active_at, timezone')
      .eq('user_id', TEST_USER_ID)
      .lt('last_active_at', new Date(nowMs - 2 * HOUR_MS).toISOString())
      .maybeSingle();
    if (testRow && !candidates.some((u) => u.user_id === TEST_USER_ID)) {
      candidates.push(testRow);
    }

    // 2. Keep only those whose LOCAL time is the send hour right now — this both
    // targets local morning and naturally caps each user to one attempt/day.
    // (The test user's config skips this gate so it fires every hourly run.)
    const due = candidates.filter((u) =>
      tierConfig(u.user_id).gateLocalHour ? localHour(u.timezone) === SEND_HOUR : true
    );
    if (due.length === 0) {
      return jsonResponse({ success: true, candidates: candidates.length, due: 0, sent: 0 }, 200);
    }
    const ids = due.map((u) => u.user_id);

    // 3. Batch-load everything we need to decide + send.
    const [settingsRows, tokenRows, stateRows] = await Promise.all([
      (async () => {
        const rows: any[] = [];
        for (const c of chunk(ids, 500)) {
          const { data } = await supabase
            .from('user_settings')
            .select('user_id, language, notifications_enabled, healthkit_enabled')
            .in('user_id', c);
          if (data) rows.push(...data);
        }
        return rows;
      })(),
      (async () => {
        const rows: any[] = [];
        for (const c of chunk(ids, 500)) {
          const { data } = await supabase
            .from('push_tokens')
            .select('user_id, expo_push_token')
            .in('user_id', c);
          if (data) rows.push(...data);
        }
        return rows;
      })(),
      (async () => {
        const rows: any[] = [];
        for (const c of chunk(ids, 500)) {
          const { data } = await supabase
            .from('reengagement_state')
            .select('user_id, last_nudge_at, last_tier')
            .in('user_id', c);
          if (data) rows.push(...data);
        }
        return rows;
      })(),
    ]);

    const settings = new Map<string, any>(settingsRows.map((r) => [r.user_id, r]));
    const state = new Map<string, any>(stateRows.map((r) => [r.user_id, r]));
    const tokensByUser = new Map<string, string[]>();
    for (const r of tokenRows) {
      const list = tokensByUser.get(r.user_id) ?? [];
      list.push(r.expo_push_token);
      tokensByUser.set(r.user_id, list);
    }

    // 4. Feature-usage sets (existence = "used"). Apple Health comes from the
    // healthkit_enabled flag we already fetched.
    const [usedGoals, usedTodos, usedGrove, usedStore, usedBlocklist] = await Promise.all([
      usersWithRows(supabase, 'focus_goals', ids),
      usersWithRows(supabase, 'todos', ids),
      usersWithRows(supabase, 'grove_profiles', ids),
      usersWithRows(supabase, 'purchases', ids),
      // A default row exists with an empty blob; only a non-empty selection counts.
      usersWithRows(supabase, 'blocklist_selections', ids, (q) => q.neq('selection_blob', '')),
    ]);
    const usedByFeature: Record<Feature, (id: string, s: any) => boolean> = {
      goals: (id) => usedGoals.has(id),
      todos: (id) => usedTodos.has(id),
      grove: (id) => usedGrove.has(id),
      store: (id) => usedStore.has(id),
      blocklist: (id) => usedBlocklist.has(id),
      health: (_id, s) => !!s?.healthkit_enabled,
    };

    // 5. Decide + build push messages.
    const messages: any[] = [];
    const stateUpserts: any[] = [];
    let skippedNoToken = 0;
    let skippedNotifOff = 0;
    let skippedDedup = 0;

    for (const u of due) {
      const s = settings.get(u.user_id);
      if (s && s.notifications_enabled === false) {
        skippedNotifOff++;
        continue;
      }
      const tokens = tokensByUser.get(u.user_id);
      if (!tokens || tokens.length === 0) {
        skippedNoToken++;
        continue;
      }

      const cfg = tierConfig(u.user_id);
      const lastActiveMs = new Date(u.last_active_at).getTime();
      const inactiveUnits = Math.floor((nowMs - lastActiveMs) / cfg.unit);
      const level = tierToSend(inactiveUnits, lastActiveMs, state.get(u.user_id), nowMs, cfg.unit);
      if (!level) {
        skippedDedup++;
        continue;
      }
      const tier = `${level}${cfg.unit === HOUR_MS ? 'h' : 'd'}`; // e.g. '5d' / '5h'

      const unused = FEATURES.filter((f) => !usedByFeature[f](u.user_id, s));
      const promo: Promo = unused.length > 0 ? pickRandom(unused) : pickRandom(['focus', 'suggest'] as const);

      const lang = normalizeLang(s?.language);
      const copy = COPY[promo][lang] ?? COPY[promo].en;

      for (const token of tokens) {
        messages.push({
          to: token,
          sound: 'default',
          title: copy.title,
          body: copy.body,
          data: { type: 'reengage', feature: promo, tier },
        });
      }
      stateUpserts.push({
        user_id: u.user_id,
        last_nudge_at: new Date(nowMs).toISOString(),
        last_tier: tier,
        last_feature: promo,
      });
    }

    // 6. Send (Expo caps batches at 100) and record what we sent.
    let sent = 0;
    for (const batch of chunk(messages, 100)) {
      try {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });
        sent += batch.length;
      } catch (pushError) {
        console.error('Push send error:', pushError);
      }
    }

    if (stateUpserts.length > 0) {
      for (const c of chunk(stateUpserts, 500)) {
        const { error: upsertError } = await supabase
          .from('reengagement_state')
          .upsert(c, { onConflict: 'user_id' });
        if (upsertError) console.error('reengagement_state upsert error:', upsertError.message);
      }
    }

    return jsonResponse(
      {
        success: true,
        candidates: candidates.length,
        due: due.length,
        nudged: stateUpserts.length,
        pushesSent: sent,
        skipped: { noToken: skippedNoToken, notifOff: skippedNotifOff, dedup: skippedDedup },
      },
      200
    );
  } catch (error) {
    console.error('reengagement-cron error:', error);
    return jsonResponse({ error: 'internal_error' }, 500);
  }
});
