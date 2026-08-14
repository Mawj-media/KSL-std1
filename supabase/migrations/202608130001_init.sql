-- KSL GRC Compliance - schema
-- Run this in the Supabase SQL editor.
-- RLS is enabled with no anon policies: the app accesses the DB via the
-- service role key from server-only code, and the anon key has zero access.

create extension if not exists "pgcrypto";

-- Users synced from Clerk via webhooks
create table if not exists public.users (
  id text primary key,
  email text,
  name text,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Standard module content managed via the admin dashboard
create table if not exists public.standards (
  code text primary key,
  content_html text not null default '',
  content_status text not null default 'draft' check (content_status in ('draft', 'published')),
  available boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Per-user access grants (org_id reserved for multi-tenant phase)
create table if not exists public.access_grants (
  user_id text not null references public.users (id) on delete cascade,
  standard_code text not null references public.standards (code) on delete cascade,
  org_id text,
  granted_at timestamptz not null default now(),
  granted_by text,
  primary key (user_id, standard_code)
);

-- Per-user progress per standard
create table if not exists public.progress (
  user_id text not null references public.users (id) on delete cascade,
  standard_code text not null references public.standards (code) on delete cascade,
  status text not null default 'viewed' check (status in ('viewed', 'completed')),
  viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, standard_code)
);

-- Activity tracking log
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event_type text not null,
  standard_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_user on public.activity_events (user_id, created_at desc);
create index if not exists idx_activity_type on public.activity_events (event_type);
create index if not exists idx_grants_standard on public.access_grants (standard_code);
create index if not exists idx_progress_user on public.progress (user_id);

-- Deny-all by default; the service role key bypasses RLS
alter table public.users enable row level security;
alter table public.standards enable row level security;
alter table public.access_grants enable row level security;
alter table public.progress enable row level security;
alter table public.activity_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
