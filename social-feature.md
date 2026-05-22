# Grove — Social Feed for Bittersweet
Inspired by:
Ios health sharing https://www.youtube.com/shorts/59l4sJNa6uE
App "Are you dead"
## The Core Insight

The app already has the perfect atomic unit for social: **the focus session**. Each
session has a tag (with emoji), duration, time range, and optional notes. This is
inherently shareable — lightweight, non-invasive, and meaningful. Unlike social media
where people curate highlight reels, focus sessions are honest artifacts of effort.
That's our social moat.

---

## Architecture: Sign-in vs. Grove (Separate Concerns)

### Sign-in (universal, independent of social)
- Sign in with Apple for cloud sync, restore purchases, backup data
- Creates a backend account but does NOT imply social participation
- Solo users sign in and remain invisible to everyone
- Available to all users from Settings > Account

### Grove opt-in (social layer, requires sign-in)
- A separate, explicit step where a signed-in user chooses to be social
- Involves: setting a display name / avatar, choosing what to share, getting a friend link
- The social profile is a separate entity attached to the account only when they choose
- Can be disabled at any time — hides tab, pauses sharing, keeps account intact

**Key rule:** The backend user record exists independently of any social profile. A user
can have an account for years and never touch Grove.

---

## Where It Lives: Adaptive Tab Bar (Opt-in)

The Grove tab only appears after a user opts in. Before that, the app keeps its
current 4-tab layout (Journal, Focus, Insights, Settings). No wasted space, no
distraction for solo users.

### Discovery for non-Grove users

**Primary:** A card in Settings under a "Grove" section:
- Brief pitch + "Set Up Grove" CTA
- Low-pressure, discoverable, out of the way

**Secondary:** A one-time milestone prompt after proven engagement (e.g., 10th session
or first 7-day streak):
- "You've been consistent. Want to see how friends are doing?"
- Dismissible permanently; only shown to signed-in users
- Never stack two friction steps (sign-in + Grove) — only prompt Grove to
  users who already have an account

**Occasional:** A subtle banner on session-complete modal:
- "3 friends focused today" or "Share this session?"
- Only if they haven't explicitly dismissed social features

### What to avoid
- Never make an empty tab a "marketing page" for the feature
- If they haven't opted in, the feature simply doesn't exist in their UI

### Settings structure

```
Settings
├── Account (Sign in with Apple, sync, purchases)
│   └── available to everyone
│
├── Grove
│   ├── IF not opted in:
│   │     "Focus with friends" card
│   │     Brief pitch + "Set Up Grove" button
│   │     Tapping → profile setup (name, avatar, privacy defaults)
│   │     → Grove tab appears after completion
│   │
│   └── IF opted in:
│         Display name, avatar, privacy controls
│         Friend management, invite link
│         "Disable Grove" option (hides tab, pauses sharing)
```

---

## Screen Structure: The Grove Tab

Two sections: a highlights carousel on top, rankings list below. Inspired by
iOS Fitness sharing layout.

### Top — Highlights Carousel

A horizontal swipeable carousel of rich, full-width cards. Each card IS a friend's
recent activity — avatar, name, session details, all in one visual unit. No separate
avatar row + feed list. One card = one friend's latest highlight.

```
┌─────────────────────────────────┐
│                                 │
│  🧑 Ali              2h ago    │
│                                 │
│  📚 Deep Reading                │
│  45 min                         │
│  "Finally finished chapter 12"  │
│                                 │
│                      🍎 +9      │
│                                 │
│  🔥 5-day streak    [👏]       │
│                                 │
└─────────────────────────────────┘
  ●  ○  ○  ○                  [+]
```

- Each card shows: avatar + name, tag emoji + name, duration, optional note,
  fruits earned, current streak
- **Live sessions** get distinct visual treatment — green-tinted card, pulse
  animation, "Live" badge, "Join" button (starts your own session with same tag)
- **Recency** shown per card — "2h ago", "Live", "Yesterday"
- **Single-tap reaction** button on each card (e.g., 👏) — sends encouragement.
  No comments, no likes count. Key to "without pressure" positioning.
- **Scope:** Today + yesterday only. Not an infinite feed.
- **[+] button** at the end of the carousel opens the Add Friends flow
- Tapping the card opens a detail view: their recent sessions list, weekly total,
  streak history

**Card sort order (deterministic, no "seen" tracking):**
1. Live sessions — always first (most actionable)
2. New activity since last tab visit — marked with a small "new" dot badge
3. Recency — most recent session first among the rest

No per-card scroll/view tracking. Instead, store a single `lastGroveVisit` timestamp
locally. On tab open, compare against each friend's latest session timestamp — cards
with newer activity get the "new" dot. Dots clear on next tab visit. Simple, reliable,
no dwell-time inference.

### Below — Grove Rankings

A vertical scrollable list, always visible below the carousel. Shows weekly
leaderboard with visual progress.

```
┌──────────────────────────────────────┐
│  🏆 This Week's Grove               │
│                                      │
│  1. 🌳 Sam        12h 45m   ████▓   │
│  2. 🌲 You         9h 30m   ███▒    │
│  3. 🌱 Ali         6h 15m   ██░     │
│  4. 🪴 Mae         3h 00m   █       │
│                                      │
│  Your rank: #2 of 4                  │
└──────────────────────────────────────┘
```

- Tree icons grow based on activity level (🪴 → 🌱 → 🌲 → 🌳) — ties into the
  fruit/tree metaphor
- Horizontal progress bars with existing color palette (blue primary, green for leader)
- **Period toggle:** This Week | This Month
- **Tag filter:** "Who focused most on Exercise?"

**Three ranking segments (horizontal segmented control):**

1. **Focus Time** — ranked by total focus session minutes. #1 = most focused.
   The default view. Uses tree growth icons (🪴 → 🌱 → 🌲 → 🌳).

2. **Phone Pickups** — ranked by number of phone pickups. #1 = fewest pickups
   (least distracted). Reinforces the "put your phone down" message. Lower is better.

3. **Screen Time** — ranked by total screen time. #1 = least screen time.
   The inverse ranking — celebrating restraint, not usage. Lower is better.

Note: Phone pickups and screen time data require iOS Screen Time API access
(DeviceActivityReport). Privacy-sensitive — users must explicitly opt in to share
these metrics. If a user doesn't share, they simply don't appear in that segment's
ranking (no placeholder, no "N/A").

- Show "Your personal best this week" alongside rankings — motivate, not shame
- Never show "0 minutes" for a bad week — show streak or lifetime total instead

**Group filter (created from the leaderboard):**

The rankings section is where groups are born. A dropdown/picker above the leaderboard
lets you scope rankings to a specific group or "All Friends" (default).

- **Create a group:** From the rankings header, tap the group picker → "New Group" →
  name it → select existing friends to add. Lightweight — no group leader concept,
  just a named collection.
- **Group view shows only group members.** When a group is selected, the ranking
  list is exclusively that group's members — not your full friend list with highlights.
  The point is a scoped comparison.
- **Group visibility:** Everyone in the group can see each other's rankings within
  that group, even if they aren't direct friends yet.
- **Friend discovery from groups:** If you see someone in a group ranking who you
  aren't friends with, you can tap their card and send a friend request directly.
  This makes groups a natural channel for expanding your Grove without sharing links
  or scanning QR codes.
- **Anyone in the group can add members:** No single owner bottleneck. Any member
  can invite their existing friends into the group.
- **Groups only affect rankings.** The carousel and activity feed always show all
  your direct friends — no group filtering there. Groups are a leaderboard lens only.

---

## Heartbeat — Inner Circle Check-ins

A passive wellness signal. Your focus sessions are your "heartbeat." If you go silent
for too long, your closest friends get a gentle prompt to check in on you.

### Inner Circle (separate trust layer)

- Max 2-3 people. Not the whole friend list — only the people who would genuinely
  worry if something was wrong.
- Explicit invite + explicit accept. Mutual consent required.
- **Directional** — you can be in someone's Inner Circle without them being in yours.
- Setup: Settings > Grove > Inner Circle

### Quiet Threshold

- **Default: 3 days** of zero focus sessions before anything triggers.
- Configurable: 3, 5, 7, 14 days. Can be fine-tuned later based on user behavior data.
- Generous enough to filter out normal life fluctuations (busy day, weekend off).

### "I'm okay" Pause (Vacation Mode)

- One-tap pause from the Grove tab header (heart icon) or Settings > Grove > Inner Circle.
- Set duration: 1 week, 2 weeks, 1 month, or indefinite.
- Inner Circle friends see "Ali is on a break" — no details, no explanation required.
- Suppresses all heartbeat alerts for the pause period.

### The Check-in Alert (Gentle, Not Alarming)

**What happens when the threshold is crossed:**

1. The friend's carousel card in Grove shifts to a **muted/faded state** with a soft
   prompt: "You haven't seen Ali in a while. Send a check-in?"
2. Tapping sends a **pre-written gentle nudge** — not a custom message. Something like
   "Hey, thinking of you" with a small heart/wave animation.
3. The recipient sees it **next time they open the app** — not as a push notification.
   No urgency theater.

**Optional escalation (off by default, user-configured):**
- The user who sets up their heartbeat can opt in to escalation.
- If threshold + 3 more days pass with no app activity and no response to the check-in,
  THEN send a push notification to the Inner Circle member.
- This is explicitly opted into by the heartbeat owner, not the watcher.

### What Heartbeat is NOT

- Not a daily activity tracker for friends ("Ali focused 0 minutes today")
- Not a push notification on day 1 of inactivity
- Not visible to regular Grove friends — only Inner Circle
- Not automatic — every part is explicit opt-in on both sides
- Not a source of guilt — the generous threshold + pause mode ensure users never feel
  forced to focus just to keep their heartbeat alive

### Where It Lives in the UI

- **Setup:** Settings > Grove > Inner Circle
- **Your status:** Small heart icon on the Grove tab header. Tap to see heartbeat
  status or pause. Pulsing = active, static = paused.
- **Friend alert:** Muted carousel card state + check-in prompt (only for Inner Circle
  friends who crossed the threshold)

---

## Social Graph: Mesh + Groups as Lenses

The Grove uses a **flat, peer-to-peer friend mesh** as the foundation. Groups exist
as filtered views on top — not a separate social structure.

**The mesh (foundation):**
- 1:1 friend connections are the atomic unit. You add friends individually.
- Your carousel and activity feed always show all friends regardless of group.
- Adding one friend gives you immediate value — no critical mass needed.

**Groups (leaderboard lenses):**
- Created directly from the rankings section — the natural place where you think
  "I want to compare against just these people."
- A named collection of existing friends (e.g., "College friends", "Work team").
- No single owner — any member can invite their existing friends into the group.
- Everyone in the group sees each other in that group's rankings, even if they
  aren't direct friends yet — enabling organic friend discovery.
- Groups don't affect the carousel or feed. They only filter the leaderboard.

---

## Add Friends Flow

Keep it native and frictionless:

1. **Share Link** — generate a unique invite link (deep link via Expo). Primary viral
   mechanic.
2. **Phone Contacts** — request contact access, match by phone/email against backend
3. **QR Code** — for in-person adding (show your code, scan theirs)
4. **Search by username** — secondary

---

## Privacy Controls (Essential)

Under Settings > Grove (only visible after opt-in):

- **What to share:** Toggle per-tag (e.g., share "Deep Work" but not "Therapy journaling")
- **Share notes:** On/Off (default Off — notes are personal)
- **Show live status:** On/Off
- **Who can see me:** Friends only / Nobody (pause sharing)
- **Visible stats:** Total time only / Full breakdown / Nothing

Existing type fields (shareStats, allowFriendRequests, showOnlineStatus) align with this.

---

## Viral Mechanics — Making It Spread

### 1. "Focus Together" Nudge
When you see a friend is currently focusing, tap "Join" to start your own session with
the same tag. After both sessions complete, both get a **bonus fruit multiplier (1.2x)**.
Real-time social loop without any messaging.

### 2. Weekly Digest Push Notification
Every Sunday evening: "You ranked #2 in your Grove this week. Sam beat you by 3h 15m.
Start a session to close the gap?" — opt-in, not spammy.

### 3. Invite Incentive
When you invite a friend and they complete their first session: both earn bonus fruits.

### 4. Streak Challenges
"Challenge Ali to a 7-day streak" — both must focus daily for 7 days. Completing it
earns a badge/fruit bonus. Low-pressure (competing on consistency, not duration).

### 5. Share Card
After completing a session, a "Share" button on session-complete generates a beautiful
image card:

```
┌──────────────────────────────────┐
│  🍎 Bittersweet                  │
│                                  │
│  I just focused for 45 minutes   │
│  📚 Deep Reading                 │
│                                  │
│  🔥 12-day streak               │
│  Join me: [link]                 │
└──────────────────────────────────┘
```

Shareable to iMessage, Instagram Stories, etc. Link deep-links to the app / App Store.

### 6. "Garden" Visualization
Each friend group collectively grows a shared garden. Every focus session adds a plant.
Over weeks, the garden fills up. Passive, ambient visualization — no leaderboard
pressure, just shared growth.

---

## UX Principles

1. **Ambient awareness, not active engagement** — Glanceable dashboard, not a scrolling
   addiction. No infinite scroll. Today + yesterday, then stop.
2. **No text messaging** — Reactions only (single-tap fruit/emoji). If people want to
   talk, they'll text outside the app.
3. **Opt-in everything** — Every piece of shared data is a conscious choice. Default to
   minimal sharing.
4. **Positive-sum competition** — Motivate, not shame. Personal bests alongside rankings.
5. **No follower counts** — Everyone in the Grove is equal. No public friend counts, no
   popularity metrics.

---

## Integration Points (Existing Codebase)

- **Session completion** (session-complete.tsx): Add "Share to Grove" toggle + share
  card button
- **Focus screen** (index.tsx): Small indicator "2 friends focusing now" above tag
  selector — subtle social nudge (only for Grove users)
- **Store**: New `social` slice in Zustand store for friend list, feed data, reactions
- **Notifications service**: Extend for friend activity notifications, weekly digests
- **Live Activity**: Show "Sam is also focusing" in Dynamic Island during your session
- **Tab layout**: Conditional 5th tab rendering based on Grove opt-in flag in store

---

## Phased Rollout

### Phase 1 — Foundation
- Sign in with Apple (universal, not Grove-specific)
- Basic backend (user accounts, session syncing)
- Grove opt-in flow (profile setup, privacy defaults)
- Adaptive tab bar (conditional Grove tab)

### Phase 2 — Feed
- Grove tab with friend carousel + activity feed
- Single-tap reactions
- Add friends via link / contacts

### Phase 3 — Competition
- Weekly leaderboard with tree growth icons
- Streak challenges between friends
- Fruit multipliers for Focus Together

### Phase 4 — Virality
- Share cards on session completion
- Invite incentives (bonus fruits)
- Weekly digest notifications
- Garden visualization
