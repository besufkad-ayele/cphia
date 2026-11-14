-- Server-side session invalidation for admin JWTs (revoke other devices).
alter table public.admins
  add column if not exists session_version integer not null default 0;

drop function if exists public.verify_admin_login(text, text);

create function public.verify_admin_login(p_email text, p_password text)
returns table(
  id uuid,
  email text,
  full_name text,
  role text,
  status text,
  permissions text[],
  role_key text,
  session_version integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    a.id,
    a.email,
    a.full_name,
    a.role,
    a.status,
    a.permissions,
    a.role_key,
    a.session_version
  from public.admins a
  where lower(a.email) = lower(btrim(p_email))
    and a.status = 'active'
    and a.password_hash is not null
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;
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
declare
  v_password_changed boolean := false;
begin
  if p_password is not null and length(btrim(p_password)) > 0 and length(p_password) < 8 then
    return jsonb_build_object('error', 'WEAK_PASSWORD');
  end if;
  if not exists (select 1 from public.admins where id = p_id) then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  v_password_changed := p_password is not null and length(btrim(p_password)) > 0;

  update public.admins
  set
    full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
    role = case when p_role = 'super_admin' then 'super_admin' else 'admin' end,
    role_key = nullif(btrim(p_role_key), ''),
    permissions = coalesce(p_permissions, permissions),
    status = case when p_status in ('active', 'disabled') then p_status else status end,
    password_hash = case
      when not v_password_changed then password_hash
      else extensions.crypt(p_password, extensions.gen_salt('bf'))
    end,
    session_version = case
      when v_password_changed then session_version + 1
      else session_version
    end
  where id = p_id;

  return jsonb_build_object('id', p_id);
end;
$$;

revoke all on function public.verify_admin_login(text, text) from public, anon, authenticated;
revoke all on function public.update_admin_user(uuid, text, text, text, text[], text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.verify_admin_login(text, text) to service_role;
    grant execute on function public.update_admin_user(uuid, text, text, text, text[], text, text) to service_role;
  end if;
end
$$;
