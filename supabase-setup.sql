-- Run this in your Supabase SQL editor (https://supabase.com/dashboard)
-- Go to: SQL Editor > New Query > paste this > Run

-- Create the progress table
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress_data jsonb not null default '{}'::jsonb,
  streak_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.user_progress enable row level security;

-- Users can only read/write their own data
create policy "Users can read own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.user_progress for update
  using (auth.uid() = user_id);
