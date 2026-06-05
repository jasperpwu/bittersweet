/** Types for the Shared Tag feature */

export interface SharedTagLink {
  id: string;
  ownerUserId: string;
  tagId: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface SharedTagMembership {
  id: string;
  ownerUserId: string;
  ownerTagId: string;
  joinerUserId: string;
  joinerTagId: string;
  joinedAt: string;
  leftAt?: string;
}

/** Shape returned by the resolve_shared_tag_code RPC */
export interface SharedTagResolveResult {
  owner_user_id: string;
  owner_tag_id: string;
  tag_name: string;
  tag_icon: string;
  tag_color: string;
  owner_display_name: string;
}

export interface JoinerDailyStat {
  day: string; // YYYY-MM-DD
  total_minutes: number;
  session_count: number;
}

export interface JoinerStats {
  membership_id: string;
  joiner_user_id: string;
  display_name: string;
  avatar_color: string | null;
  daily_stats: JoinerDailyStat[];
}
