// Localized text for Live Activity pushes.
//
// A Live Activity that is started or updated by a push renders text the server
// sent — the phone's JS isn't running to call i18n.t(), so the labels the app
// normally passes through `laLabels()` (src/services/LiveActivityService.ts)
// have to travel in the payload instead. The widget falls back to English when a
// label is absent, which is exactly what we're avoiding here.
//
// ⚠️ LABELS is a copy of `liveActivity.*` in src/i18n/locales/*.json, not a
// re-translation. If you change a label there, change it here; they are rendered
// by the same SwiftUI view (targets/LiveActivity/LiveActivityView.swift) and
// must not diverge depending on whether a session started on the phone or the
// laptop. Regenerate with:
//
//   node -e 'const fs=require("fs");for(const l of ["en","de","es","fr","ja","ko","pt-BR","zh-Hans","hi","bn","ru","ar","ur"])console.log(l, JSON.stringify(JSON.parse(fs.readFileSync("src/i18n/locales/"+l+".json","utf8")).liveActivity))'
//
// Unlike the heartbeat copy next door, this text goes to the ACTOR, not to
// another user: the person whose laptop started the session is the person whose
// phone shows it. Resolve the language of the user who owns the session.

import type { Lang } from './i18n.ts';

/** Button/status labels rendered natively inside the Live Activity. */
export const LABELS: Record<
  'start' | 'end' | 'unlocked' | 'unblockExpired',
  Record<Lang, string>
> = {
  start: {
    en: 'Start',
    de: 'Starten',
    es: 'Iniciar',
    fr: 'Démarrer',
    ja: '開始',
    ko: '시작',
    'pt-BR': 'Iniciar',
    'zh-Hans': '开始',
    hi: 'शुरू',
    bn: 'শুরু',
    ru: 'Старт',
    ar: 'ابدأ',
    ur: 'شروع',
  },
  end: {
    en: 'End',
    de: 'Beenden',
    es: 'Terminar',
    fr: 'Terminer',
    ja: '終了',
    ko: '종료',
    'pt-BR': 'Encerrar',
    'zh-Hans': '结束',
    hi: 'समाप्त',
    bn: 'শেষ',
    ru: 'Стоп',
    ar: 'إنهاء',
    ur: 'ختم',
  },
  unlocked: {
    en: 'Unlocked',
    de: 'Freigeschaltet',
    es: 'Desbloqueado',
    fr: 'Débloqué',
    ja: 'アンロック中',
    ko: '잠금 해제됨',
    'pt-BR': 'Desbloqueado',
    'zh-Hans': '已解锁',
    hi: 'अनलॉक',
    bn: 'আনলক হয়েছে',
    ru: 'Разблокировано',
    ar: 'مفتوح',
    ur: 'اَن لاک',
  },
  unblockExpired: {
    en: 'Unblock Expired',
    de: 'Freischaltung abgelaufen',
    es: 'Desbloqueo finalizado',
    fr: 'Déblocage terminé',
    ja: 'アンロック終了',
    ko: '잠금 해제 종료',
    'pt-BR': 'Desbloqueio encerrado',
    'zh-Hans': '解锁已结束',
    hi: 'अनब्लॉक समाप्त',
    bn: 'আনব্লক শেষ',
    ru: 'Разблокировка истекла',
    ar: 'انتهى الفتح',
    ur: 'اَن بلاک ختم',
  },
};

/**
 * Banner shown when a Live Activity is started by push.
 *
 * Not optional: Apple requires an `alert` in every push-to-start payload
 * ("Include an alert in the JSON payload" — Starting and updating Live
 * Activities with ActivityKit push notifications). Update and end pushes carry
 * no alert, so this fires once per remotely-started session and never again.
 *
 * "Computer" rather than "desktop" throughout — it translates as an everyday
 * word in every language here, where "desktop" tends to land as either jargon or
 * a literal tabletop.
 */
export const REMOTE_START_ALERT: Record<Lang, { title: string; body: string }> = {
  en: { title: 'Focus session started', body: 'You started this from your computer.' },
  de: { title: 'Fokus-Sitzung gestartet', body: 'Du hast sie an deinem Computer gestartet.' },
  es: { title: 'Sesión de concentración iniciada', body: 'La iniciaste desde tu computadora.' },
  fr: { title: 'Session de concentration lancée', body: 'Tu l’as lancée depuis ton ordinateur.' },
  ja: { title: 'フォーカスを開始しました', body: 'パソコンから開始されました。' },
  ko: { title: '집중 세션을 시작했어요', body: '컴퓨터에서 시작했어요.' },
  'pt-BR': { title: 'Sessão de foco iniciada', body: 'Você iniciou pelo computador.' },
  'zh-Hans': { title: '专注已开始', body: '这次专注是从电脑上开始的。' },
  hi: { title: 'फ़ोकस सेशन शुरू', body: 'आपने इसे अपने कंप्यूटर से शुरू किया।' },
  bn: { title: 'ফোকাস সেশন শুরু হয়েছে', body: 'আপনি এটি আপনার কম্পিউটার থেকে শুরু করেছেন।' },
  ru: { title: 'Сессия фокуса началась', body: 'Вы запустили её с компьютера.' },
  ar: { title: 'بدأت جلسة التركيز', body: 'لقد بدأتها من جهاز الكمبيوتر.' },
  ur: { title: 'فوکس سیشن شروع', body: 'آپ نے اسے اپنے کمپیوٹر سے شروع کیا۔' },
};

/** The four labels, in the shape the Live Activity ContentState expects. */
export function labelsFor(lang: Lang) {
  return {
    startLabel: LABELS.start[lang],
    endLabel: LABELS.end[lang],
    unlockedLabel: LABELS.unlocked[lang],
    unblockExpiredLabel: LABELS.unblockExpired[lang],
  };
}
