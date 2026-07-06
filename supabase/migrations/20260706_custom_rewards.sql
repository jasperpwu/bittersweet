-- ============================================================
-- Custom rewards: user-defined fruit-store items (Custom tab).
-- List pattern — same as purchases/badges. Buying one records a
-- purchases row with product_id `custom_<id>`; the definition
-- row stays (soft-deletable) so history can render name/emoji.
--
-- Also adds purchases.photo_url: the photo a user attaches to a
-- bought custom reward (public URL in the purchase-photos
-- bucket, or a device-local file:// path until upload succeeds).
-- ============================================================

create table public.custom_rewards (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  cost integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_custom_rewards_user on public.custom_rewards(user_id);

alter table public.custom_rewards enable row level security;

create policy "Users can read own custom rewards"
  on public.custom_rewards for select
  using (auth.uid() = user_id);

create policy "Users can insert own custom rewards"
  on public.custom_rewards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own custom rewards"
  on public.custom_rewards for update
  using (auth.uid() = user_id);

create policy "Users can delete own custom rewards"
  on public.custom_rewards for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger set_custom_rewards_updated_at
  before update on public.custom_rewards
  for each row execute function public.set_updated_at();

-- Photo attached to a purchase (custom rewards only for now)
alter table public.purchases add column photo_url text;

-- ============================================================
-- Storage bucket: purchase-photos
-- Create via Supabase Dashboard → Storage → New Bucket
-- Name: purchase-photos
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Photos are stored at {user_id}/{purchase_id}.jpg. The bucket is
-- public (readable by URL) but the URL is only ever shown to the
-- owner; only owners can upload/delete.
--
-- Storage policy (run after creating the bucket):
-- CREATE POLICY "Users can manage own purchase photos"
-- ON storage.objects FOR ALL
-- USING (bucket_id = 'purchase-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
-- WITH CHECK (bucket_id = 'purchase-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
-- ============================================================
