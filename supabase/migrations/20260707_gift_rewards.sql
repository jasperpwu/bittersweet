-- ============================================================
-- Gift rewards: a Grove user creates a reward FOR a friend.
-- Cross-user by design, so this does NOT ride the per-user sync
-- pipeline (custom_rewards/purchases are RLS auth.uid()=user_id);
-- it follows the grove_challenges pattern instead: shared row
-- visible to both parties, race-sensitive mutations via
-- SECURITY DEFINER RPCs.
--
-- Lifecycle: created (unbought, sender-cancellable)
--   -> purchased_at set (recipient bought it with their fruits;
--      the fruit debit is a normal client-side purchases row with
--      product_id gift_<id>)
--   -> photo_url set (either party captures the gifting moment;
--      first photo wins). purchased_at set + photo_url null is
--      the "pending action" state both parties see.
-- ============================================================

create table public.gift_rewards (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  cost integer not null default 1,
  purchased_at timestamptz,
  photo_url text,
  photo_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_rewards_no_self check (sender_id <> recipient_id)
);

create index idx_gift_rewards_sender on public.gift_rewards(sender_id);
create index idx_gift_rewards_recipient on public.gift_rewards(recipient_id);

alter table public.gift_rewards enable row level security;

create policy "Gift parties can read gifts"
  on public.gift_rewards for select
  using (auth.uid() in (sender_id, recipient_id));

-- Only the sender inserts, and only for an accepted Grove friend.
create policy "Senders can create gifts for friends"
  on public.gift_rewards for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.grove_friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = recipient_id)
          or (f.addressee_id = auth.uid() and f.requester_id = recipient_id)
        )
    )
  );

-- Sender can cancel only while unbought. No UPDATE policy at all:
-- purchased_at/photo_url are only ever set via the RPCs below.
create policy "Senders can cancel unbought gifts"
  on public.gift_rewards for delete
  using (auth.uid() = sender_id and purchased_at is null);

create trigger set_gift_rewards_updated_at
  before update on public.gift_rewards
  for each row execute function public.set_updated_at();

-- Exactly-once purchase: only the recipient, only while unbought.
-- The conditional UPDATE is the race guard (same approach as
-- claim_challenge_reward) — only the first caller flips
-- purchased_at from NULL, so the client debits fruits exactly once.
create or replace function purchase_gift_reward(p_gift_id uuid)
returns json language plpgsql security definer as $$
declare
  v_cost integer;
begin
  update gift_rewards
  set purchased_at = now(), updated_at = now()
  where id = p_gift_id
    and recipient_id = auth.uid()
    and purchased_at is null
  returning cost into v_cost;

  if not found then
    return json_build_object('purchased', false);
  end if;

  return json_build_object('purchased', true, 'cost', v_cost);
end;
$$;

-- First photo wins: either party, only after purchase, only while
-- photo_url is NULL. On a lost race returns the winner's photo_url
-- so the client can adopt it.
create or replace function set_gift_photo(p_gift_id uuid, p_photo_url text)
returns json language plpgsql security definer as $$
declare
  v_existing text;
begin
  update gift_rewards
  set photo_url = p_photo_url, photo_by = auth.uid(), updated_at = now()
  where id = p_gift_id
    and auth.uid() in (sender_id, recipient_id)
    and purchased_at is not null
    and photo_url is null;

  if not found then
    select photo_url into v_existing
    from gift_rewards
    where id = p_gift_id
      and auth.uid() in (sender_id, recipient_id);
    return json_build_object('set', false, 'photo_url', v_existing);
  end if;

  return json_build_object('set', true, 'photo_url', p_photo_url);
end;
$$;

-- ============================================================
-- Storage bucket: gift-photos
-- Create via Supabase Dashboard → Storage → New Bucket
-- Name: gift-photos
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Photos live at the bucket root as {gift_id}.jpg — a flat path so
-- one policy covers both parties (unlike purchase-photos, which is
-- owner-foldered). Upload uses upsert:false so the first file wins;
-- a duplicate-object error means the other party already captured it.
--
-- Storage policy (run after creating the bucket):
-- CREATE POLICY "Gift parties can manage gift photos"
-- ON storage.objects FOR ALL
-- USING (
--   bucket_id = 'gift-photos'
--   AND EXISTS (
--     SELECT 1 FROM public.gift_rewards g
--     WHERE name = g.id::text || '.jpg'
--       AND auth.uid() IN (g.sender_id, g.recipient_id)
--   )
-- )
-- WITH CHECK (
--   bucket_id = 'gift-photos'
--   AND EXISTS (
--     SELECT 1 FROM public.gift_rewards g
--     WHERE name = g.id::text || '.jpg'
--       AND auth.uid() IN (g.sender_id, g.recipient_id)
--   )
-- );
-- ============================================================
