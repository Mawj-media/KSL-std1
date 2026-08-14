-- Multi-tenant organizations (Clerk Organizations product)
-- Run via: npm run db:push

-- Firms purchased on a yearly license, mirrored from Clerk organizations
create table if not exists public.organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership join table (one row per user per org), mirrored from Clerk
-- organizationMembership events. org_role: 'admin' = org admin, 'member' = learner.
create table if not exists public.organization_members (
  organization_id text not null references public.organizations (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  org_role text not null default 'member' check (org_role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Allow org admins to mark a standard N/A for a user
alter table public.progress drop constraint if exists progress_status_check;
alter table public.progress add constraint progress_status_check check (status in ('viewed', 'completed', 'na'));

create index if not exists idx_org_members_user on public.organization_members (user_id);
create index if not exists idx_org_members_org on public.organization_members (organization_id);
create index if not exists idx_progress_standard on public.progress (standard_code);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

revoke all on all tables in schema public from anon, authenticated;