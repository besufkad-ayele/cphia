create extension if not exists pgcrypto;

alter table public.admins
  add column if not exists permissions text[] not null default '{}',
  add column if not exists role_key text,
  add column if not exists created_by uuid;

update public.admins
set
  permissions = array['dashboard','volunteers','attendance','shifts','cohorts','forms','users','roles'],
  role_key = 'super_admin'
where role = 'super_admin';

update public.admins
set
  permissions = array['dashboard','volunteers','attendance','shifts','cohorts','forms'],
  role_key = coalesce(nullif(role_key, ''), 'cohort_lead')
where role <> 'super_admin'
  and cardinality(permissions) = 0;

create table if not exists public.ops_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  venue text not null default '',
  starts_on date,
  ends_on date,
  description text not null default '',
  status text not null default 'planning' check (status in ('planning', 'open', 'active', 'closed')),
  capacity integer not null default 0 check (capacity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ops_shifts (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.ops_cohorts(id) on delete cascade,
  name text not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  location text not null default '',
  sector text not null default '',
  capacity integer not null default 0 check (capacity >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.ops_attendance (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.ops_shifts(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  notes text not null default '',
  marked_by uuid,
  checked_in_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (shift_id, registration_id)
);

create table if not exists public.ops_forms (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.ops_cohorts(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.ops_forms(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  volunteer_name text not null default '',
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ops_shifts_date on public.ops_shifts (shift_date);
create index if not exists idx_ops_shifts_cohort on public.ops_shifts (cohort_id);
create index if not exists idx_ops_attendance_shift on public.ops_attendance (shift_id);
create index if not exists idx_ops_forms_status on public.ops_forms (status);

alter table public.ops_roles enable row level security;
alter table public.ops_cohorts enable row level security;
alter table public.ops_shifts enable row level security;
alter table public.ops_attendance enable row level security;
alter table public.ops_forms enable row level security;
alter table public.ops_form_responses enable row level security;

revoke all on public.ops_roles from anon, authenticated;
revoke all on public.ops_cohorts from anon, authenticated;
revoke all on public.ops_shifts from anon, authenticated;
revoke all on public.ops_attendance from anon, authenticated;
revoke all on public.ops_forms from anon, authenticated;
revoke all on public.ops_form_responses from anon, authenticated;

insert into public.ops_roles (key, name, description, permissions, is_system) values
  ('super_admin', 'Super admin', 'Full desk, including team accounts and role access.', array['dashboard','volunteers','attendance','shifts','cohorts','forms','users','roles'], true),
  ('cohort_lead', 'Cohort lead', 'Runs a cohort: volunteers, roster, attendance, and forms.', array['dashboard','volunteers','attendance','shifts','cohorts','forms'], false),
  ('shift_lead', 'Shift lead', 'Opens the roster and marks who showed up.', array['dashboard','attendance','shifts'], false),
  ('registrar', 'Registrar', 'Reviews volunteers and builds forms.', array['dashboard','volunteers','forms'], false),
  ('viewer', 'Viewer', 'Opens the dashboard and the volunteer list.', array['dashboard','volunteers'], false)
on conflict (key) do nothing;

update public.ops_roles
set
  permissions = array['dashboard','volunteers','attendance','shifts','cohorts','forms','users','roles'],
  is_system = true
where key = 'super_admin';

insert into public.ops_cohorts (name, code, venue, description, status, capacity)
values (
  'CPHIA-26 facility volunteers',
  'CPHIA-26',
  '',
  'Main facility volunteer cohort. Set the venue and dates when the conference plan is confirmed.',
  'active',
  0
)
on conflict (code) do nothing;

drop function if exists public.verify_admin_login(text, text);

create function public.verify_admin_login(p_email text, p_password text)
returns table(id uuid, email text, full_name text, role text, status text, permissions text[], role_key text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select a.id, a.email, a.full_name, a.role, a.status, a.permissions, a.role_key
  from public.admins a
  where lower(a.email) = lower(btrim(p_email))
    and a.status = 'active'
    and a.password_hash is not null
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;
end;
$$;

create or replace function public.create_admin_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_role_key text,
  p_permissions text[],
  p_created_by uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_password is null or length(p_password) < 8 then
    return jsonb_build_object('error', 'WEAK_PASSWORD');
  end if;
  if exists (select 1 from public.admins where lower(email) = lower(btrim(p_email))) then
    return jsonb_build_object('error', 'DUPLICATE_EMAIL');
  end if;

  insert into public.admins (id, email, full_name, role, status, password_hash, permissions, role_key, created_by)
  values (
    v_id,
    lower(btrim(p_email)),
    btrim(p_full_name),
    case when p_role = 'super_admin' then 'super_admin' else 'admin' end,
    'active',
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    coalesce(p_permissions, '{}'::text[]),
    nullif(btrim(p_role_key), ''),
    p_created_by
  );
  return jsonb_build_object('id', v_id);
exception
  when unique_violation then
    return jsonb_build_object('error', 'DUPLICATE_EMAIL');
end;
$$;

create or replace function public.update_admin_user(
  p_id uuid,
  p_full_name text,
  p_role text,
  p_role_key text,
  p_permissions text[],
  p_status text,
  p_password text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_password is not null and length(btrim(p_password)) > 0 and length(p_password) < 8 then
    return jsonb_build_object('error', 'WEAK_PASSWORD');
  end if;
  if not exists (select 1 from public.admins where id = p_id) then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  update public.admins
  set
    full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
    role = case when p_role = 'super_admin' then 'super_admin' else 'admin' end,
    role_key = nullif(btrim(p_role_key), ''),
    permissions = coalesce(p_permissions, permissions),
    status = case when p_status in ('active', 'disabled') then p_status else status end,
    password_hash = case
      when p_password is null or length(btrim(p_password)) = 0 then password_hash
      else extensions.crypt(p_password, extensions.gen_salt('bf'))
    end
  where id = p_id;

  return jsonb_build_object('id', p_id);
end;
$$;

revoke all on function public.verify_admin_login(text, text) from public, anon, authenticated;
revoke all on function public.create_admin_user(text, text, text, text, text, text[], uuid) from public, anon, authenticated;
revoke all on function public.update_admin_user(uuid, text, text, text, text[], text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.verify_admin_login(text, text) to service_role;
    grant execute on function public.create_admin_user(text, text, text, text, text, text[], uuid) to service_role;
    grant execute on function public.update_admin_user(uuid, text, text, text, text[], text, text) to service_role;
  end if;
end
$$;
