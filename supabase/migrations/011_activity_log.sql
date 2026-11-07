create table if not exists public.ops_activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text not null default '',
  actor_name text not null default '',
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  request_path text not null default '',
  ip text not null default ''
);

create index if not exists idx_ops_activity_created on public.ops_activity_log (created_at desc);
create index if not exists idx_ops_activity_action on public.ops_activity_log (action);
create index if not exists idx_ops_activity_actor on public.ops_activity_log (actor_id);
create index if not exists idx_ops_activity_entity on public.ops_activity_log (entity_type, entity_id);

alter table public.ops_activity_log enable row level security;

revoke all on public.ops_activity_log from anon, authenticated;
