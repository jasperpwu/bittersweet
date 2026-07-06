-- ============================================================
-- Purchases: fruit-store purchase history (accelerate cards,
-- usage tips, future products). List pattern — same as
-- badges/coach_reports. tip_id records WHICH tip a usage-tip
-- purchase returned, so the app can serve un-bought tips.
-- ============================================================

create table public.purchases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  cost integer not null default 0,
  tip_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_purchases_user on public.purchases(user_id);

alter table public.purchases enable row level security;

create policy "Users can read own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "Users can insert own purchases"
  on public.purchases for insert
  with check (auth.uid() = user_id);

create policy "Users can update own purchases"
  on public.purchases for update
  using (auth.uid() = user_id);

create policy "Users can delete own purchases"
  on public.purchases for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger set_purchases_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();
