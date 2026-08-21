-- APNs device tokens for pushes Expo's push service cannot send.
--
-- Every existing notification in this project goes through Expo Push Service
-- (exp.host/--/api/v2/push/send), which only speaks `apns-push-type: alert`.
-- Live Activity pushes (`liveactivity`) and, later, WidgetKit pushes (`widgets`)
-- are separate APNs push types with their own topics and their own tokens, so
-- they need a direct APNs connection and a place to keep those tokens. That is
-- what this table is; `push_tokens` (Expo tokens) is unrelated and stays.
--
-- Three kinds, all from ActivityKit / WidgetKit rather than UNUserNotification:
--   'pushtostart'  — Activity<Attributes>.pushToStartTokenUpdates. One per app
--                    install, valid whether or not an activity is running, and
--                    the only way to start a Live Activity on a phone whose app
--                    has been swiped away. iOS 17.2+.
--   'liveactivity' — activity.pushTokenUpdates. Scoped to ONE activity: it dies
--                    with that activity, and updating or ending an activity is
--                    only possible with its own token.
--   'widget'       — WidgetKit push token. Phase 4; nothing writes it yet.
--
-- `activity_id` is what makes the 'liveactivity' rows usable. An update token is
-- meaningless without knowing which activity it addresses, and the app deletes
-- the row when that activity reports .ended/.dismissed so we stop pushing at a
-- token APNs would only answer 410 for.
--
-- `bundle_id` is stored rather than configured because the APNs topic must match
-- the app that owns the token (`<bundle id>.push-type.liveactivity`), and this
-- project ships two bundle IDs — com.path2us.bittersweet and the .dev variant
-- (app.config.js:10). A server-side constant would silently push dev tokens
-- against the production topic and get 400 TopicDisallowed.

create table if not exists public.device_push_tokens (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('widget', 'liveactivity', 'pushtostart')),
  token       text not null,
  -- Set for kind='liveactivity' only; null for app-scoped tokens.
  activity_id text,
  -- The app the token belongs to, e.g. 'com.path2us.bittersweet.dev'.
  bundle_id   text not null,
  -- Appearance the device was last seen in ('light' | 'dark').
  --
  -- Only meaningful for 'pushtostart'. A Live Activity's colors live in its
  -- ActivityAttributes, which are fixed when the activity is created, and the
  -- app picks them from Appearance.getColorScheme() at that moment
  -- (LiveActivityService.LA_COLORS). When the server creates the activity
  -- instead, it has to be told. `user_settings.theme` is not enough: its most
  -- common value is 'system', which resolves on the device, not here.
  color_scheme text check (color_scheme in ('light', 'dark')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, kind, token)
);

-- The send path is always "latest token of this kind for this user".
create index if not exists device_push_tokens_lookup_idx
  on public.device_push_tokens (user_id, kind, updated_at desc);

alter table public.device_push_tokens enable row level security;

-- Matching every other syncable table: a user may only touch their own rows.
-- The edge function reads these with the service role, which bypasses RLS.
drop policy if exists "Users can read own device push tokens" on public.device_push_tokens;
create policy "Users can read own device push tokens"
  on public.device_push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own device push tokens" on public.device_push_tokens;
create policy "Users can insert own device push tokens"
  on public.device_push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own device push tokens" on public.device_push_tokens;
create policy "Users can update own device push tokens"
  on public.device_push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own device push tokens" on public.device_push_tokens;
create policy "Users can delete own device push tokens"
  on public.device_push_tokens for delete
  using (auth.uid() = user_id);
