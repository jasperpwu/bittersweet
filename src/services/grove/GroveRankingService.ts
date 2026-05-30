import { supabase } from '../../config/supabase';

// --- Types ---

export interface RankingItem {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  avatarColor: string;
  totalMinutes: number;
  rank: number;
  treeIcon: string;
  isCurrentUser: boolean;
}

// --- Helpers ---

/**
 * Get tree icon based on total minutes in the period.
 * 🪴 (< 2h), 🌱 (2–5h), 🌲 (5–10h), 🌳 (10h+)
 */
function getTreeIcon(totalMinutes: number): string {
  if (totalMinutes >= 600) return '🌳';
  if (totalMinutes >= 300) return '🌲';
  if (totalMinutes >= 120) return '🌱';
  return '🪴';
}

/**
 * Get the start of the current ISO week (Monday 00:00 UTC).
 */
export function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday;
}

/**
 * Get the end of the current ISO week (next Monday 00:00 UTC).
 */
export function getWeekEnd(): Date {
  const start = getWeekStart();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

/**
 * Get the start of the current month (1st, 00:00 UTC).
 */
export function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Get the end of the current month (1st of next month, 00:00 UTC).
 */
export function getMonthEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// --- Service ---

export const GroveRankingService = {
  /**
   * Fetch rankings for a given period via the server-side RPC.
   */
  async fetchRankings(period: 'week' | 'month'): Promise<RankingItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const periodStart = period === 'week' ? getWeekStart() : getMonthStart();
    const periodEnd = period === 'week' ? getWeekEnd() : getMonthEnd();

    const { data, error } = await supabase.rpc('get_grove_rankings', {
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    });

    if (error) throw error;

    const rows: any[] = data || [];

    return rows.map((row: any, index: number) => ({
      userId: row.user_id,
      displayName: row.profile.display_name,
      handle: row.profile.handle,
      avatarUrl: row.profile.avatar_url,
      avatarColor: row.profile.avatar_color,
      totalMinutes: Number(row.total_minutes),
      rank: index + 1,
      treeIcon: getTreeIcon(Number(row.total_minutes)),
      isCurrentUser: row.user_id === user.id,
    }));
  },
};
