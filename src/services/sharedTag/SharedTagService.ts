import { supabase } from '../../config/supabase';
import type {
  SharedTagLink,
  SharedTagMembership,
  SharedTagResolveResult,
  JoinerStats,
} from './types';

function generateCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I/L)
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export const SharedTagService = {
  /**
   * Generate (or return existing) share code for a tag.
   * Sets is_sharing = true on the tag row.
   */
  async generateShareCode(tagId: string): Promise<SharedTagLink> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check for existing active link
    const { data: existing, error: fetchError } = await supabase
      .from('shared_tag_links')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('tag_id', tagId)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      return {
        id: existing.id,
        ownerUserId: existing.owner_user_id,
        tagId: existing.tag_id,
        code: existing.code,
        isActive: existing.is_active,
        createdAt: existing.created_at,
      };
    }

    // Generate new code
    const code = generateCode();

    const { data, error } = await supabase
      .from('shared_tag_links')
      .insert({ owner_user_id: user.id, tag_id: tagId, code })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      ownerUserId: data.owner_user_id,
      tagId: data.tag_id,
      code: data.code,
      isActive: data.is_active,
      createdAt: data.created_at,
    };
  },

  /**
   * Deactivate the share code for a tag (stop accepting new joins).
   */
  async deactivateShareCode(tagId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('shared_tag_links')
      .update({ is_active: false })
      .eq('owner_user_id', user.id)
      .eq('tag_id', tagId);

    if (error) throw error;
  },

  /**
   * Resolve a share code via the RPC. Returns tag info + owner name.
   */
  async resolveShareCode(code: string): Promise<SharedTagResolveResult> {
    const { data, error } = await supabase.rpc('resolve_shared_tag_code', {
      share_code: code.toUpperCase().trim(),
    });

    if (error) throw error;

    const result = data as any;
    if (result.error) {
      throw new Error(result.error);
    }

    return result as SharedTagResolveResult;
  },

  /**
   * Create a membership row when a joiner joins a shared tag.
   */
  async createMembership(
    ownerTagId: string,
    ownerUserId: string,
    joinerTagId: string
  ): Promise<SharedTagMembership> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('shared_tag_memberships')
      .upsert(
        {
          owner_user_id: ownerUserId,
          owner_tag_id: ownerTagId,
          joiner_user_id: user.id,
          joiner_tag_id: joinerTagId,
          joined_at: new Date().toISOString(),
          left_at: null,
        },
        { onConflict: 'owner_tag_id,joiner_user_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      ownerUserId: data.owner_user_id,
      ownerTagId: data.owner_tag_id,
      joinerUserId: data.joiner_user_id,
      joinerTagId: data.joiner_tag_id,
      joinedAt: data.joined_at,
      leftAt: data.left_at ?? undefined,
    };
  },

  /**
   * Joiner leaves: sets left_at on membership.
   */
  async leaveMembership(joinerTagId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('shared_tag_memberships')
      .update({ left_at: new Date().toISOString() })
      .eq('joiner_user_id', user.id)
      .eq('joiner_tag_id', joinerTagId)
      .is('left_at', null);

    if (error) throw error;
  },

  /**
   * Owner removes a joiner from a shared tag.
   */
  async removeJoiner(membershipId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('shared_tag_memberships')
      .update({ left_at: new Date().toISOString() })
      .eq('id', membershipId)
      .eq('owner_user_id', user.id);

    if (error) throw error;
  },

  /**
   * Fetch active memberships for a shared tag (owner's view).
   */
  async fetchMemberships(ownerTagId: string): Promise<SharedTagMembership[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('shared_tag_memberships')
      .select('*')
      .eq('owner_tag_id', ownerTagId)
      .eq('owner_user_id', user.id)
      .is('left_at', null);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      ownerTagId: row.owner_tag_id,
      joinerUserId: row.joiner_user_id,
      joinerTagId: row.joiner_tag_id,
      joinedAt: row.joined_at,
      leftAt: row.left_at ?? undefined,
    }));
  },

  /**
   * Fetch per-joiner daily stats for a shared tag (calls RPC).
   */
  async fetchJoinerStats(
    ownerTagId: string,
    startDate: string,
    endDate: string,
    timezone: string = 'UTC'
  ): Promise<JoinerStats[]> {
    const { data, error } = await supabase.rpc('get_shared_tag_joiner_stats', {
      p_owner_tag_id: ownerTagId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_user_tz: timezone,
    });

    if (error) throw error;

    const result = data as any;
    if (result?.error) {
      throw new Error(result.error);
    }

    return (Array.isArray(result) ? result : []) as JoinerStats[];
  },
};
