-- Per-user saved module answers (persisted when a standard is completed)
create table if not exists public.module_answers (
  user_id text not null references public.users (id) on delete cascade,
  standard_code text not null references public.standards (code) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, standard_code)
);

alter table public.module_answers enable row level security;
revoke all on all tables in schema public from anon, authenticated;
