// Localized copy for inner-circle heartbeat alerts.
//
// Shared by heartbeat-cron, heartbeat-blocklist-notify,
// heartbeat-inner-circle-remove and delete-account. Each of those writes the
// SAME string twice: as the push body, and as `heartbeat_notifications.
// notification_text`, which the app renders verbatim in the Notifications list
// (app/(modals)/grove-notifications.tsx). Both are per-recipient, so both get
// the recipient's language.
//
// Because the row stores finished prose, the text is frozen in whatever
// language the recipient had at write time — a later language switch does not
// re-translate old alerts (same freeze as coach reports and badges).
//
// Placeholders: {name} (the user the alert is about), {days} (quiet threshold).
// Wording notes: several languages avoid a gendered verb agreeing with {name}
// (Russian/Arabic) by restating the sentence around the object — keep that if
// you edit these; we don't know the subject's gender.

import type { Lang } from './i18n.ts';

export const HEARTBEAT_TRIGGERS = [
  'quiet_threshold',
  'blocklist_edit',
  'blocklist_cleared',
  'heartbeat_paused',
  'threshold_changed',
  'circle_removed',
  'account_deleted',
] as const;

export type HeartbeatTrigger = (typeof HEARTBEAT_TRIGGERS)[number];

/** Push title — shared by every heartbeat alert. */
export const ALERT_TITLE: Record<Lang, string> = {
  en: 'Inner Circle Alert',
  de: 'Hinweis aus dem Inneren Kreis',
  es: 'Aviso del círculo cercano',
  fr: 'Alerte cercle proche',
  ja: 'インナーサークルのお知らせ',
  ko: '이너 서클 알림',
  'pt-BR': 'Aviso do círculo íntimo',
  'zh-Hans': '核心圈提醒',
  hi: 'कोर सर्कल अलर्ट',
  bn: 'ইনার সার্কেল সতর্কতা',
  ru: 'Оповещение ближнего круга',
  ar: 'تنبيه الدائرة المقرّبة',
  ur: 'قریبی حلقہ الرٹ',
};

export const HEARTBEAT_TEXT: Record<HeartbeatTrigger, Record<Lang, string>> = {
  quiet_threshold: {
    en: '{name} has been quiet for {days} days. Maybe check in?',
    de: '{name} ist seit {days} Tagen still. Vielleicht mal nachfragen?',
    es: '{name} lleva {days} días en silencio. ¿Le escribes?',
    fr: '{name} est silencieux depuis {days} jours. Prenez de ses nouvelles ?',
    ja: '{name} さんが {days} 日間音沙汰ありません。様子を聞いてみませんか？',
    ko: '{name} 님이 {days}일째 조용해요. 안부를 물어볼까요?',
    'pt-BR': '{name} está quieto há {days} dias. Que tal dar um alô?',
    'zh-Hans': '{name} 已经 {days} 天没有动静了，要不要问候一下？',
    hi: '{name} {days} दिनों से चुप हैं। हाल पूछ लें?',
    bn: '{name} {days} দিন ধরে চুপ। একটু খোঁজ নেবেন?',
    ru: 'От {name} нет вестей уже {days} дн. Может, написать?',
    ar: 'لا أخبار من {name} منذ {days} يوم. ما رأيك أن تطمئن عليه؟',
    ur: '{name} کی {days} دن سے کوئی خبر نہیں۔ خیریت پوچھ لیں؟',
  },
  blocklist_edit: {
    en: '{name} made changes to their blocked apps.',
    de: '{name} hat die blockierten Apps geändert.',
    es: '{name} ha cambiado sus apps bloqueadas.',
    fr: '{name} a modifié ses applis bloquées.',
    ja: '{name} さんがブロック中のアプリを変更しました。',
    ko: '{name} 님이 차단 앱을 변경했어요.',
    'pt-BR': '{name} mudou os apps bloqueados.',
    'zh-Hans': '{name} 修改了屏蔽的应用。',
    hi: '{name} ने अपने ब्लॉक किए ऐप बदले हैं।',
    bn: '{name} তাদের ব্লক করা অ্যাপ বদলেছেন।',
    ru: 'Список заблокированных приложений у {name} изменился.',
    ar: 'تغيّرت التطبيقات المحجوبة لدى {name}.',
    ur: '{name} نے اپنی بلاک کردہ ایپس تبدیل کی ہیں۔',
  },
  blocklist_cleared: {
    en: 'Heads up — {name} cleared their entire blocklist and is no longer blocking any apps.',
    de: 'Achtung – {name} hat die gesamte Blockliste geleert und blockiert keine Apps mehr.',
    es: 'Atención: {name} ha vaciado su lista de bloqueo y ya no bloquea ninguna app.',
    fr: 'Attention : {name} a vidé sa liste de blocage et ne bloque plus aucune appli.',
    ja: 'お知らせ：{name} さんがブロックリストをすべて解除し、アプリをブロックしなくなりました。',
    ko: '알려드려요 — {name} 님이 차단 목록을 모두 지워서 이제 아무 앱도 차단하지 않아요.',
    'pt-BR': 'Atenção: {name} limpou toda a lista de bloqueio e não bloqueia mais nenhum app.',
    'zh-Hans': '注意——{name} 清空了屏蔽名单，现在不再屏蔽任何应用。',
    hi: 'ध्यान दें — {name} ने पूरी ब्लॉकलिस्ट हटा दी है और अब कोई ऐप ब्लॉक नहीं है।',
    bn: 'খেয়াল করুন — {name} পুরো ব্লকলিস্ট মুছে দিয়েছেন, এখন কোনো অ্যাপ ব্লক করা নেই।',
    ru: 'Внимание: список блокировки у {name} полностью очищен — приложения больше не блокируются.',
    ar: 'تنبيه: أُفرغت قائمة الحجب لدى {name} ولم تعد أي تطبيقات محجوبة.',
    ur: 'توجہ — {name} کی پوری بلاک لسٹ صاف ہو گئی ہے اور اب کوئی ایپ بلاک نہیں۔',
  },
  heartbeat_paused: {
    en: '{name} is taking a break from their heartbeat.',
    de: '{name} legt eine Pause vom Herzschlag ein.',
    es: '{name} ha puesto su latido en pausa.',
    fr: '{name} met son battement en pause.',
    ja: '{name} さんがハートビートを一時停止しました。',
    ko: '{name} 님이 하트비트를 잠시 멈췄어요.',
    'pt-BR': '{name} pausou o pulso por um tempo.',
    'zh-Hans': '{name} 暂时停用了心跳。',
    hi: '{name} ने अपनी हार्टबीट कुछ समय के लिए रोक दी है।',
    bn: '{name} কিছু সময়ের জন্য হার্টবিট থামিয়েছেন।',
    ru: 'Пульс у {name} поставлен на паузу.',
    ar: 'النبض لدى {name} متوقف مؤقتًا.',
    ur: '{name} نے اپنی ہارٹ بیٹ کچھ دیر کے لیے روک دی ہے۔',
  },
  threshold_changed: {
    en: "{name} raised their quiet threshold, so they can go quiet longer before you're alerted.",
    de: '{name} hat die Stille-Schwelle erhöht und darf jetzt länger still sein, bevor du benachrichtigt wirst.',
    es: '{name} ha subido su umbral de silencio, así que puede estar en silencio más tiempo antes de que te avisemos.',
    fr: '{name} a augmenté son seuil de silence : il peut désormais rester silencieux plus longtemps avant que vous soyez alerté.',
    ja: '{name} さんが無音しきい値を上げました。通知が届くまでの猶予が長くなります。',
    ko: '{name} 님이 무응답 기준을 높였어요. 이제 더 오래 조용해도 알림이 가지 않아요.',
    'pt-BR': '{name} aumentou o limite de silêncio, então pode ficar quieto por mais tempo antes de avisarmos você.',
    'zh-Hans': '{name} 调高了静默阈值，现在可以更久没有动静才会提醒你。',
    hi: '{name} ने अपनी चुप्पी की सीमा बढ़ा दी है, इसलिए अब आपको सूचना मिलने से पहले वे ज़्यादा देर चुप रह सकते हैं।',
    bn: '{name} নীরবতার সীমা বাড়িয়েছেন, তাই আপনাকে জানানোর আগে তিনি আরও বেশি সময় চুপ থাকতে পারবেন।',
    ru: 'Порог тишины у {name} увеличен — теперь можно молчать дольше, прежде чем вам придёт оповещение.',
    ar: 'رُفع حد الغياب لدى {name}، فصار بالإمكان الغياب مدة أطول قبل أن يصلك تنبيه.',
    ur: '{name} نے خاموشی کی حد بڑھا دی ہے، اس لیے اب آپ کو اطلاع ملنے سے پہلے وہ زیادہ دیر خاموش رہ سکتے ہیں۔',
  },
  circle_removed: {
    en: '{name} removed you from their inner circle.',
    de: '{name} hat dich aus dem Inneren Kreis entfernt.',
    es: '{name} te ha quitado de su círculo cercano.',
    fr: '{name} vous a retiré de son cercle proche.',
    ja: '{name} さんがあなたをインナーサークルから外しました。',
    ko: '{name} 님이 회원님을 이너 서클에서 제외했어요.',
    'pt-BR': '{name} removeu você do círculo íntimo.',
    'zh-Hans': '{name} 把你移出了核心圈。',
    hi: '{name} ने आपको अपने कोर सर्कल से हटा दिया है।',
    bn: '{name} আপনাকে তাদের ইনার সার্কেল থেকে সরিয়ে দিয়েছেন।',
    ru: 'Вас удалили из ближнего круга {name}.',
    ar: 'أُزلت من الدائرة المقرّبة لدى {name}.',
    ur: '{name} نے آپ کو اپنے قریبی حلقے سے نکال دیا ہے۔',
  },
  account_deleted: {
    en: '{name} has deleted their Bittersweet account.',
    de: '{name} hat das Bittersweet-Konto gelöscht.',
    es: '{name} ha eliminado su cuenta de Bittersweet.',
    fr: '{name} a supprimé son compte Bittersweet.',
    ja: '{name} さんが Bittersweet のアカウントを削除しました。',
    ko: '{name} 님이 Bittersweet 계정을 삭제했어요.',
    'pt-BR': '{name} excluiu a conta do Bittersweet.',
    'zh-Hans': '{name} 已删除 Bittersweet 账户。',
    hi: '{name} ने अपना Bittersweet खाता हटा दिया है।',
    bn: '{name} তাদের Bittersweet অ্যাকাউন্ট মুছে ফেলেছেন।',
    ru: 'Аккаунт Bittersweet у {name} удалён.',
    ar: 'حُذف حساب Bittersweet الخاص بـ {name}.',
    ur: '{name} کا Bittersweet اکاؤنٹ حذف کر دیا گیا ہے۔',
  },
};

/** Fallback display name when the acting user has no profile row. */
export const SOMEONE: Record<Lang, string> = {
  en: 'Someone',
  de: 'Jemand',
  es: 'Alguien',
  fr: 'Quelqu’un',
  ja: '誰か',
  ko: '누군가',
  'pt-BR': 'Alguém',
  'zh-Hans': '某人',
  hi: 'कोई',
  bn: 'কেউ একজন',
  ru: 'Кто-то',
  ar: 'أحدهم',
  ur: 'کوئی',
};

/** Fallback display name for the account-deleted alert ("A friend"). */
export const A_FRIEND: Record<Lang, string> = {
  en: 'A friend',
  de: 'Ein Freund',
  es: 'Un amigo',
  fr: 'Un ami',
  ja: '友だち',
  ko: '친구',
  'pt-BR': 'Um amigo',
  'zh-Hans': '一位好友',
  hi: 'एक मित्र',
  bn: 'একজন বন্ধু',
  ru: 'Друг',
  ar: 'صديق',
  ur: 'ایک دوست',
};
