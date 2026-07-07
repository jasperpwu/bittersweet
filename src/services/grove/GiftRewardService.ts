import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../../config/supabase';

// --- Types ---

export interface GiftProfile {
  display_name: string;
  handle: string;
  avatar_url: string | null;
  avatar_color: string;
}

// A gift reward from the cross-user `gift_rewards` table. Unlike custom
// rewards this is server-authoritative shared state (grove pattern): the row
// is visible to both parties, purchase/photo mutations go through
// SECURITY DEFINER RPCs, and it never rides the per-user sync pipeline.
export interface GiftItem {
  id: string;
  senderId: string;
  recipientId: string;
  name: string;
  emoji: string | null;
  cost: number;
  /** null = unbought (still in the recipient's catalog, sender-cancellable). */
  purchasedAt: string | null;
  /** Purchased + null photoUrl = "capture the moment" pending action for both. */
  photoUrl: string | null;
  createdAt: string;
  /** True when the current user is the recipient. */
  isIncoming: boolean;
  /** The other party's profile: sender's for the recipient, recipient's for the sender. */
  otherProfile: GiftProfile | null;
}

export interface CreateGiftInput {
  recipientId: string;
  name: string;
  cost: number;
  emoji?: string;
}

const defaultProfile: GiftProfile = {
  display_name: 'Unknown',
  handle: 'unknown',
  avatar_url: null,
  avatar_color: '#6592E9',
};

// --- Service ---

export const GiftRewardService = {
  /**
   * Fetch all gifts involving the current user (RLS scopes the select to rows
   * where they are sender or recipient), joined with the other party's profile
   * via the same two-step profile-map pattern as fetchChallenges.
   */
  async fetchGifts(): Promise<GiftItem[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: gifts, error } = await supabase
      .from('gift_rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!gifts || gifts.length === 0) return [];

    const otherUserIds = [
      ...new Set(gifts.map((g) => (g.sender_id === user.id ? g.recipient_id : g.sender_id))),
    ];

    const { data: profiles, error: profileError } = await supabase
      .from('grove_profiles')
      .select('user_id, display_name, handle, avatar_url, avatar_color')
      .in('user_id', otherUserIds);

    if (profileError) throw profileError;

    const profileMap = new Map<string, GiftProfile>();
    for (const p of profiles || []) {
      profileMap.set(p.user_id, {
        display_name: p.display_name,
        handle: p.handle,
        avatar_url: p.avatar_url,
        avatar_color: p.avatar_color,
      });
    }

    return gifts.map((g) => {
      const isIncoming = g.recipient_id === user.id;
      const otherUserId = isIncoming ? g.sender_id : g.recipient_id;
      return {
        id: g.id,
        senderId: g.sender_id,
        recipientId: g.recipient_id,
        name: g.name,
        emoji: g.emoji ?? null,
        cost: g.cost,
        purchasedAt: g.purchased_at ?? null,
        photoUrl: g.photo_url ?? null,
        createdAt: g.created_at,
        isIncoming,
        otherProfile: profileMap.get(otherUserId) || defaultProfile,
      };
    });
  },

  /** Create a gift for a Grove friend (RLS enforces accepted friendship). */
  async createGift(input: CreateGiftInput): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('gift_rewards')
      .insert({
        sender_id: user.id,
        recipient_id: input.recipientId,
        name: input.name,
        emoji: input.emoji ?? null,
        cost: Math.max(1, Math.round(input.cost)),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  /** Cancel an unbought gift (RLS: sender only, purchased_at must be null). */
  async cancelGift(giftId: string): Promise<void> {
    const { error } = await supabase.from('gift_rewards').delete().eq('id', giftId);
    if (error) throw error;
  },

  /**
   * Mark the gift purchased, exactly once (recipient only). Returns
   * purchased=false when it was already bought — the caller must not debit.
   */
  async purchaseGift(giftId: string): Promise<{ purchased: boolean; cost?: number }> {
    const { data, error } = await supabase.rpc('purchase_gift_reward', {
      p_gift_id: giftId,
    });
    if (error) throw error;
    return data as { purchased: boolean; cost?: number };
  },

  /**
   * Record the gift photo, first-wins (either party, after purchase). On a
   * lost race returns set=false plus the winner's photo_url to adopt.
   */
  async setGiftPhotoUrl(
    giftId: string,
    photoUrl: string
  ): Promise<{ set: boolean; photo_url: string | null }> {
    const { data, error } = await supabase.rpc('set_gift_photo', {
      p_gift_id: giftId,
      p_photo_url: photoUrl,
    });
    if (error) throw error;
    return data as { set: boolean; photo_url: string | null };
  },

  /**
   * Upload the gifting-moment photo to the `gift-photos` bucket at the flat
   * path {giftId}.jpg. upsert:false on purpose — a duplicate-object error
   * means the other party's photo already landed (first-wins at the file
   * level too). Upload-only, no local copy: gift photos are shared state, so
   * the pending action may only clear once the server has the photo.
   */
  async uploadGiftPhoto(imageUri: string, giftId: string): Promise<string> {
    const result = await manipulateAsync(imageUri, [{ resize: { width: 1200 } }], {
      compress: 0.8,
      format: SaveFormat.JPEG,
    });

    const response = await fetch(result.uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const filePath = `${giftId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('gift-photos')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('gift-photos').getPublicUrl(filePath);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  },

  /** True when a storage upload failed because the object already exists. */
  isDuplicateUploadError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /already exists|duplicate/i.test(message);
  },

  /**
   * Fire the gift-notify edge function (push to the other party).
   * Fire-and-forget: pushes are best-effort, never block the mutation.
   */
  notify(giftId: string, event: 'created' | 'purchased' | 'photo_set'): void {
    supabase.functions
      .invoke('gift-notify', { body: { giftId, event } })
      .then(({ error }) => {
        if (error) console.warn('[GiftRewardService] notify failed:', error);
      })
      .catch((error: unknown) => console.warn('[GiftRewardService] notify failed:', error));
  },
};
