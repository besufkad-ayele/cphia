-- Teams under a cohort/event, shift kinds, and sheet verification.

create table if not exists public.ops_teams (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.ops_cohorts(id) on delete cascade,
  name text not null,
  code text not null default '',
  description text not null default '',
  supervisor_admin_id uuid references public.admins(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  unique (cohort_id, name)
);

create table if not exists public.ops_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.ops_teams(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'zone_captain')),
  created_at timestamptz not null default now(),
  unique (team_id, registration_id)
);

alter table public.ops_shifts
  add column if not exists kind text not null default 'training',
  add column if not exists team_id uuid references public.ops_teams(id) on delete set null,
  add column if not exists sheet_status text not null default 'open',
  add column if not exists submitted_by uuid,
  add column if not exists submitted_at timestamptz,
  add column if not exists verified_by uuid,
  add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ops_shifts_kind_check'
  ) then
    alter table public.ops_shifts
      add constraint ops_shifts_kind_check check (kind in ('training', 'ops'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'ops_shifts_sheet_status_check'
  ) then
    alter table public.ops_shifts
      add constraint ops_shifts_sheet_status_check
      check (sheet_status in ('open', 'submitted', 'verified'));
  end if;
end
$$;

create index if not exists idx_ops_teams_cohort on public.ops_teams (cohort_id);
create index if not exists idx_ops_team_members_team on public.ops_team_members (team_id);
create index if not exists idx_ops_team_members_registration on public.ops_team_members (registration_id);
create index if not exists idx_ops_shifts_team on public.ops_shifts (team_id);
create index if not exists idx_ops_shifts_kind on public.ops_shifts (kind);

alter table public.ops_teams enable row level security;
alter table public.ops_team_members enable row level security;

revoke all on public.ops_teams from anon, authenticated;
revoke all on public.ops_team_members from anon, authenticated;

-- Grant the new teams module to existing role templates and super admins.
update public.ops_roles
set permissions = (
  select array_agg(distinct p)
  from unnest(permissions || array['teams', 'floor']) as t(p)
)
where key in ('super_admin', 'cohort_lead');

update public.ops_roles
set permissions = (
  select array_agg(distinct p)
  from unnest(permissions || array['floor']) as t(p)
)
where key = 'shift_lead';

update public.admins
set permissions = (
  select array_agg(distinct p)
  from unnest(permissions || array['teams', 'floor']) as t(p)
)
where role = 'super_admin'
   or role_key in ('super_admin', 'cohort_lead');

update public.admins
set permissions = (
  select array_agg(distinct p)
  from unnest(permissions || array['floor']) as t(p)
)
where role_key = 'shift_lead';
