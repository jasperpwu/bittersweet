import type { FriendRequest } from '../services/grove/GroveFriendService';
import type { InnerCircleMember, HeartbeatAlert } from '../services/grove/GroveHeartbeatService';
import type { ChallengeItem } from '../services/grove/GroveChallengeService';
import type { GroveProfile } from '../services/grove/GroveService';

/**
 * A single entry in the Grove notifications screen. Built from existing grove
 * store data (friend requests, inner-circle invites, heartbeat alerts, finished
 * challenges) so there is no separate notifications table to keep in sync.
 */
export type GroveNotification =
  | { kind: 'friend_request'; id: string; createdAt: string; profile: GroveProfile; friendshipId: string }
  | { kind: 'circle_invite'; id: string; createdAt: string; profile: GroveProfile; inviteId: string }
  | { kind: 'heartbeat_alert'; id: string; createdAt: string; alert: HeartbeatAlert }
  | { kind: 'challenge_invite'; id: string; createdAt: string; challenge: ChallengeItem }
  | { kind: 'challenge_finished'; id: string; createdAt: string; challenge: ChallengeItem };

interface GroveNotificationInput {
  incomingRequests: FriendRequest[];
  incomingCircleInvites: InnerCircleMember[];
  heartbeatAlerts: HeartbeatAlert[];
  challenges: ChallengeItem[];
}

/**
 * Aggregate all Grove notification sources into one chronologically-sorted list
 * (newest first). Shared by the Grove tab (for the bell badge count) and the
 * notifications screen so both stay consistent.
 */
export function buildGroveNotifications(input: GroveNotificationInput): GroveNotification[] {
  const items: GroveNotification[] = [];

  for (const r of input.incomingRequests) {
    items.push({
      kind: 'friend_request',
      id: `fr-${r.friendshipId}`,
      createdAt: r.createdAt,
      profile: r.profile,
      friendshipId: r.friendshipId,
    });
  }

  for (const i of input.incomingCircleInvites) {
    items.push({
      kind: 'circle_invite',
      id: `ci-${i.id}`,
      createdAt: i.invitedAt,
      profile: i.profile,
      inviteId: i.id,
    });
  }

  for (const a of input.heartbeatAlerts) {
    items.push({
      kind: 'heartbeat_alert',
      id: `hb-${a.id}`,
      createdAt: a.sentAt,
      alert: a,
    });
  }

  for (const c of input.challenges) {
    if (c.status === 'pending' && c.isIncoming) {
      items.push({
        kind: 'challenge_invite',
        id: `chi-${c.id}`,
        createdAt: c.createdAt,
        challenge: c,
      });
    } else if ((c.status === 'completed' || c.status === 'failed') && c.endDate) {
      items.push({
        kind: 'challenge_finished',
        id: `ch-${c.id}`,
        // endDate is a YYYY-MM-DD day; anchor it to end-of-day local time for sorting.
        createdAt: `${c.endDate}T23:59:59`,
        challenge: c,
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

/**
 * Count notifications newer than the last time the user opened the notifications
 * screen. With no recorded last-seen, everything is unread.
 */
export function countUnreadGroveNotifications(
  items: GroveNotification[],
  lastSeenAt: string | null
): number {
  if (!lastSeenAt) return items.length;
  const seen = new Date(lastSeenAt).getTime();
  return items.filter((i) => new Date(i.createdAt).getTime() > seen).length;
}
