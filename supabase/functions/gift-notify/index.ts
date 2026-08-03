// Supabase Edge Function: gift-notify
// Sends a push to the other party of a gift reward when something happens:
//   created   — sender made a gift          → notify the recipient
//   purchased — recipient bought the gift   → notify the sender
//   photo_set — either party added a photo  → notify the other party
//
// Push-only (no DB notification rows). Invoked fire-and-forget by the
// client right after each mutation succeeds.
//
// Deployment: supabase functions deploy gift-notify
//
// Body: { giftId: string, event: 'created' | 'purchased' | 'photo_set' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type Lang, fetchUserLanguages, langOf, format } from '../_shared/i18n.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const VALID_EVENTS = ['created', 'purchased', 'photo_set'] as const;
type GiftEvent = (typeof VALID_EVENTS)[number];

// Localized for the RECIPIENT of the push — the other party to the gift, not
// the caller who triggered it. Placeholders: {name} (caller), {gift}.
// Gift-specific, so kept here rather than in _shared.
const PUSH_TITLE: Record<GiftEvent, Record<Lang, string>> = {
  created: {
    en: "You've got a gift 🎀",
    de: 'Du hast ein Geschenk 🎀',
    es: 'Tienes un regalo 🎀',
    fr: 'Vous avez un cadeau 🎀',
    ja: 'プレゼントが届きました 🎀',
    ko: '선물이 도착했어요 🎀',
    'pt-BR': 'Você ganhou um presente 🎀',
    'zh-Hans': '你收到一份礼物 🎀',
    hi: 'आपके लिए एक तोहफ़ा 🎀',
    bn: 'আপনার জন্য একটি উপহার 🎀',
    ru: 'Вам подарок 🎀',
    ar: 'لديك هدية 🎀',
    ur: 'آپ کے لیے ایک تحفہ 🎀',
  },
  purchased: {
    en: 'Gift redeemed 🎉',
    de: 'Geschenk eingelöst 🎉',
    es: 'Regalo canjeado 🎉',
    fr: 'Cadeau utilisé 🎉',
    ja: 'プレゼントが使われました 🎉',
    ko: '선물이 사용됐어요 🎉',
    'pt-BR': 'Presente resgatado 🎉',
    'zh-Hans': '礼物已兑换 🎉',
    hi: 'तोहफ़ा भुनाया गया 🎉',
    bn: 'উপহার ব্যবহার হয়েছে 🎉',
    ru: 'Подарок получен 🎉',
    ar: 'استُخدمت الهدية 🎉',
    ur: 'تحفہ استعمال ہو گیا 🎉',
  },
  photo_set: {
    en: 'Gift moment captured 📸',
    de: 'Geschenkmoment festgehalten 📸',
    es: 'Momento del regalo capturado 📸',
    fr: 'Moment du cadeau immortalisé 📸',
    ja: 'プレゼントの瞬間を記録 📸',
    ko: '선물의 순간을 남겼어요 📸',
    'pt-BR': 'Momento do presente registrado 📸',
    'zh-Hans': '礼物瞬间已记录 📸',
    hi: 'तोहफ़े का पल कैद हुआ 📸',
    bn: 'উপহারের মুহূর্ত ধরা পড়ল 📸',
    ru: 'Момент с подарком сохранён 📸',
    ar: 'وُثّقت لحظة الهدية 📸',
    ur: 'تحفے کا لمحہ محفوظ ہوا 📸',
  },
};

const PUSH_BODY: Record<GiftEvent, Record<Lang, string>> = {
  created: {
    en: '{name} sent you "{gift}" in the fruit store!',
    de: '{name} hat dir „{gift}“ im Obstladen geschenkt!',
    es: '{name} te ha enviado «{gift}» en la tienda de frutas.',
    fr: '{name} vous a envoyé « {gift} » dans la boutique de fruits !',
    ja: '{name} さんがフルーツストアで「{gift}」を贈ってくれました！',
    ko: '{name} 님이 과일 스토어에서 「{gift}」을(를) 보냈어요!',
    'pt-BR': '{name} enviou "{gift}" para você na loja de frutas!',
    'zh-Hans': '{name} 在水果商店送了你「{gift}」！',
    hi: '{name} ने फ्रूट स्टोर में आपको "{gift}" भेजा है!',
    bn: '{name} ফ্রুট স্টোরে আপনাকে "{gift}" পাঠিয়েছেন!',
    ru: '{name} отправил(а) вам «{gift}» во фруктовом магазине!',
    ar: 'أرسل لك {name} «{gift}» في متجر الفواكه!',
    ur: '{name} نے فروٹ اسٹور میں آپ کو "{gift}" بھیجا ہے!',
  },
  purchased: {
    en: '{name} bought your gift "{gift}" — time to capture the moment!',
    de: '{name} hat dein Geschenk „{gift}“ eingelöst – halt den Moment fest!',
    es: '{name} ha canjeado tu regalo «{gift}»: ¡captura el momento!',
    fr: '{name} a utilisé votre cadeau « {gift} » — immortalisez le moment !',
    ja: '{name} さんがあなたのプレゼント「{gift}」を使いました。その瞬間を残しましょう！',
    ko: '{name} 님이 회원님의 선물 「{gift}」을(를) 사용했어요. 순간을 남겨보세요!',
    'pt-BR': '{name} resgatou seu presente "{gift}" — hora de registrar o momento!',
    'zh-Hans': '{name} 兑换了你的礼物「{gift}」——记录下这一刻吧！',
    hi: '{name} ने आपका तोहफ़ा "{gift}" भुना लिया — इस पल को कैद कीजिए!',
    bn: '{name} আপনার উপহার "{gift}" ব্যবহার করেছেন — মুহূর্তটা ধরে রাখুন!',
    ru: '{name} воспользовал(ась)ся вашим подарком «{gift}» — сохраните момент!',
    ar: 'استخدم {name} هديتك «{gift}» — وثّق هذه اللحظة!',
    ur: '{name} نے آپ کا تحفہ "{gift}" استعمال کر لیا — اس لمحے کو محفوظ کریں!',
  },
  photo_set: {
    en: '{name} added a photo to "{gift}".',
    de: '{name} hat ein Foto zu „{gift}“ hinzugefügt.',
    es: '{name} ha añadido una foto a «{gift}».',
    fr: '{name} a ajouté une photo à « {gift} ».',
    ja: '{name} さんが「{gift}」に写真を追加しました。',
    ko: '{name} 님이 「{gift}」에 사진을 추가했어요.',
    'pt-BR': '{name} adicionou uma foto a "{gift}".',
    'zh-Hans': '{name} 给「{gift}」添加了照片。',
    hi: '{name} ने "{gift}" में एक फ़ोटो जोड़ी है।',
    bn: '{name} "{gift}"-এ একটি ছবি যোগ করেছেন।',
    ru: '{name} добавил(а) фото к «{gift}».',
    ar: 'أضاف {name} صورة إلى «{gift}».',
    ur: '{name} نے "{gift}" میں ایک تصویر شامل کی ہے۔',
  },
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    // Verify the JWT from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }

    const { giftId, event } = await req.json();

    if (!giftId || !VALID_EVENTS.includes(event)) {
      return jsonResponse({ error: 'Invalid giftId or event' }, 400);
    }

    const { data: gift, error: giftError } = await supabase
      .from('gift_rewards')
      .select('id, sender_id, recipient_id, name')
      .eq('id', giftId)
      .maybeSingle();

    if (giftError || !gift) {
      return jsonResponse({ error: 'Gift not found' }, 404);
    }

    // Who may fire each event, and who gets notified.
    let targetUserId: string;
    if (event === 'created') {
      if (user.id !== gift.sender_id) {
        return jsonResponse({ error: 'Only the sender can announce a gift' }, 403);
      }
      targetUserId = gift.recipient_id;
    } else if (event === 'purchased') {
      if (user.id !== gift.recipient_id) {
        return jsonResponse({ error: 'Only the recipient can announce a purchase' }, 403);
      }
      targetUserId = gift.sender_id;
    } else {
      if (user.id !== gift.sender_id && user.id !== gift.recipient_id) {
        return jsonResponse({ error: 'Not a party of this gift' }, 403);
      }
      targetUserId = user.id === gift.sender_id ? gift.recipient_id : gift.sender_id;
    }

    // Caller's display name for the copy
    const { data: profile, error: profileError } = await supabase
      .from('grove_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: 'Profile not found' }, 404);
    }

    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', targetUserId);

    if (tokensError || !tokens || tokens.length === 0) {
      return jsonResponse({ success: true, skipped: true, reason: 'no_push_tokens' }, 200);
    }

    // Localize for the target — the other party to the gift, who reads this.
    const langs = await fetchUserLanguages(supabase, [targetUserId]);
    const lang = langOf(langs, targetUserId);

    const pushMessages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: PUSH_TITLE[event as GiftEvent][lang],
      body: format(PUSH_BODY[event as GiftEvent][lang], {
        name: profile.display_name,
        gift: gift.name,
      }),
      data: { type: 'gift', event, giftId },
    }));

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages),
      });
    } catch (pushError) {
      console.error('Push notification send error:', pushError);
      return jsonResponse({ error: 'Push send failed' }, 500);
    }

    return jsonResponse({ success: true, notified: tokens.length }, 200);
  } catch (error) {
    console.error('Gift notify error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
