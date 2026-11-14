-- Desk-wide settings (registration gate, etc.). Single-row / key-value store.
create table if not exists public.ops_desk_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admins(id) on delete set null
);

alter table public.ops_desk_settings enable row level security;
revoke all on public.ops_desk_settings from anon, authenticated;

comment on table public.ops_desk_settings is
  'Ops desk flags. registration_open (boolean) controls the public /register form and API.';

insert into public.ops_desk_settings (key, value)
values ('registration_open', 'true'::jsonb)
on conflict (key) do nothing;
