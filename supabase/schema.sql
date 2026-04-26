create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  email text not null unique,
  bonus_balance integer not null default 0,
  visit_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create table if not exists public.loyalty_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  title text not null,
  description text,
  points_delta integer not null,
  visit_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reward_code text not null,
  reward_title text not null,
  points_spent integer not null,
  status text not null default 'sent_to_master',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_phone on public.profiles(phone);
create index if not exists idx_loyalty_events_profile_id on public.loyalty_events(profile_id);
create index if not exists idx_reward_requests_profile_id on public.reward_requests(profile_id);

alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.reward_requests enable row level security;

create policy "Public can read published reviews"
on public.reviews
for select
using (status = 'published');

-- Остальные политики и auth-связку нужно будет адаптировать,
-- когда подключим настоящий вход через Supabase Auth.
