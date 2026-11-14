-- Per-device admin sessions so desk users can see and revoke specific devices.
create table if not exists public.admin_device_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins (id) on delete cascade,
  device_label text not null default 'Unknown device',
  user_agent text not null default '',
  ip text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_admin_device_sessions_admin
  on public.admin_device_sessions (admin_id, revoked_at, last_seen_at desc);

create index if not exists idx_admin_device_sessions_active
  on public.admin_device_sessions (admin_id)
  where revoked_at is null;

alter table public.admin_device_sessions enable row level security;

revoke all on public.admin_device_sessions from anon, authenticated;
