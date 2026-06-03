-- Drop the reward_transactions table (no longer used)
drop policy if exists "Users can read own transactions" on public.reward_transactions;
drop policy if exists "Users can insert own transactions" on public.reward_transactions;
drop index if exists idx_reward_transactions_user;
drop table if exists public.reward_transactions;

-- Add accelerate_multiplier to focus_sessions (tracks whether accelerate card was active)
alter table public.focus_sessions
  add column if not exists accelerate_multiplier integer not null default 1;
