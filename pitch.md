# Bittersweet

**Reclaim your time. Grow with your people.**

---

## The Problem

We are losing our attention — and we know it.

The average person picks up their phone 150 times a day. Screen time apps tell you
the damage after it's done. Pomodoro timers help for a session, then you forget. And
when you finally build a focus habit, you do it alone — with no one to notice, no one
to care, and no one to catch you if you fall off.

Meanwhile, the apps stealing your attention have something you don't: a social graph
working against you. Every notification, every like, every "Sam is typing..." is
engineered to pull you back.

What if your social graph worked *for* you instead?

---

## The Product

**Bittersweet** is a focus app that turns your attention into a currency — and your
friends into accountability partners.

### How it works

**1. Focus and earn.**

Start a focus session. Tag it — Deep Work, Reading, Exercise, whatever matters to you.
While you focus, your phone's distracting apps are blocked using iOS Screen Time. When
you finish, you earn fruits — an in-app currency proportional to your focus time.

**2. Spend to unlock.**

Want to check Instagram? Spend your fruits. Every minute of distraction costs you the
focus you earned. This creates a tangible, felt cost to context-switching. Users don't
need willpower — they need a price tag.

**3. Track and reflect.**

A personal journal logs every session with timestamps, tags, and optional notes. Weekly
insights show where your time actually goes. Goals let you set targets — "4 hours of
deep work this week" — with real progress tracking.

**This loop alone is powerful.** Users build streaks, earn hundreds of fruits, and
report that the unlock cost makes them think twice before opening blocked apps. The
reward isn't the fruit — it's the pause.

---

## The Social Layer: Grove

Solo focus works. Social focus is contagious.

**Grove** is an opt-in social feed where friends share focus activity — not selfies,
not status updates, not opinions. Just honest artifacts of effort.

### What you see

Open the Grove tab and swipe through highlight cards — each one is a friend's recent
focus session. Ali read for 45 minutes. Sam is coding right now. Mae hit a 12-day
streak. You see what the people you care about are actually spending their time on.

Below the carousel, a weekly leaderboard ranks your friends by focus time. Tree icons
grow with activity — from a seedling to a full tree. You're #2 this week. Sam is
ahead by 3 hours. Maybe you'll start one more session tonight.

### What you don't see

No comments. No like counts. No follower numbers. No DMs. No infinite scroll. The feed
shows today and yesterday, then stops. If you want to encourage someone, you send a
single-tap reaction — a fruit tossed their way. If you want to talk, you text them
outside the app.

This is not another social network. It's a window into your friends' effort — ambient,
glanceable, pressure-free.

### Focus Together

See a friend focusing right now? Tap "Join" to start your own session with the same
tag. When you both finish, you each earn a 1.2x fruit bonus. No coordination needed,
no scheduling — just spontaneous parallel focus. This is the mechanic that makes Grove
feel alive.

### Heartbeat

For your closest 2-3 people — the ones who would actually worry — there's Heartbeat.
Your focus sessions are your pulse. If you go silent for 3 days, your Inner Circle
gets a gentle nudge: "You haven't seen Ali in a while. Send a check-in?" One tap sends
a "thinking of you." No custom messages, no pressure — just a signal that someone
noticed.

Users can pause Heartbeat anytime ("I'm on vacation") and their circle just sees
"Ali is on a break." No explanation required.

This isn't a feature. It's a promise: if you disappear, someone will notice.

---

## Why It Spreads

**The viral loop is baked into the product:**

1. You focus. You earn fruits. You see your rank. You want your friends to join so you
   have someone to compete with.

2. You share a session card to iMessage or Instagram Stories — a beautiful image with
   your streak, your session, and a deep link. Your friend downloads the app.

3. They invite their friends. The leaderboard fills up. Now everyone has skin in the
   game.

4. Weekly digest: "You ranked #2 this week. Sam beat you by 3h." — one push
   notification that actually makes someone open the app to focus, not to scroll.

**The incentive structure:**
- Invite a friend → both earn bonus fruits when they complete their first session
- Focus Together → 1.2x multiplier for parallel sessions
- Streak Challenges → "7-day streak challenge with Ali" creates mutual accountability

Every viral mechanic results in more focusing, not more scrolling. The product gets
better the more friends you add, but it never requires them. Solo users get full value
from day one.

---

## Why Now

**Screen Time awareness is mainstream.** People know they have a problem. iOS Screen
Time showed them the number, but gave them no solution beyond a weak "limit" they
dismiss every time. The demand for tools that actually work is established.

**App blocking APIs are finally available.** Apple's Family Controls / Screen Time API
(DeviceActivityMonitor, ManagedSettings) now allows third-party apps to block and
unblock apps programmatically. This was impossible before iOS 16. Bittersweet uses
this to enforce real consequences — not suggestions, not reminders, actual blocked
access that costs earned currency to override.

**Social accountability is proven.** Strava proved that sharing workouts makes people
exercise more. Duolingo proved that streaks and leaderboards drive daily habits.
Bittersweet applies the same mechanics to the one habit everyone is trying to build:
paying attention.

**The mental health conversation has shifted.** People want to hear from their friends
without the performance of social media. "What are you actually doing?" is more
meaningful than "What do you want me to think you're doing?" Focus sessions are
inherently honest — you can't fake 45 minutes of blocked phone time.

---

## The Moat

1. **Native iOS integration.** Family Controls, Live Activities (Dynamic Island),
   home screen widgets, notifications. Deep OS-level hooks that web apps and
   cross-platform tools can't replicate. The app blocking isn't a suggestion — it's
   enforced at the system level.

2. **The social graph is purpose-built.** Unlike bolting social onto a timer app, Grove
   is designed from the ground up around focus sessions as the atomic social unit.
   The graph is small, intimate, and high-signal — the opposite of a follow/follower
   model.

3. **Switching cost compounds over time.** Your session history, streaks, fruit balance,
   tag taxonomy, goals, and friend connections all create lock-in. The longer you use
   it, the more your personal productivity data is worth to you.

4. **Network effects without network dependency.** The app is fully functional solo.
   Each friend you add makes it better, but you never hit a "this is useless without
   friends" wall. This means retention doesn't collapse if social growth stalls.

---

## Business Model

**Freemium with premium features:**

- **Free tier:** Unlimited focus sessions, basic app blocking, journal, insights,
  Grove with up to 5 friends
- **Premium ($4.99/month or $39.99/year):**
  - Unlimited Grove friends
  - Advanced insights (tag-level analytics, monthly trends, exportable reports)
  - Custom app blocking schedules
  - Heartbeat (Inner Circle check-ins)
  - Priority sync and backup
  - Share cards with custom branding

**Why this works:** The core loop (focus → earn → unlock) is free and fully functional.
Premium expands the social and analytics layers. Users convert after they've built the
habit and want more from it — not before.

---

## Traction & Status

- iOS app built with Expo / React Native, shipping on the App Store
- Core features live: focus sessions, tagging, fruit rewards, app blocking via Family
  Controls, journal, insights, goals, Live Activity support, home screen widgets
- Social layer (Grove) designed and scoped, ready for implementation

---

## The Ask

[To be filled based on fundraising context — seed round amount, use of funds,
hiring plan, timeline to Grove launch.]

---

## One-liner

**Bittersweet: the focus app where your attention is currency, your friends are
accountability partners, and someone always notices when you disappear.**
