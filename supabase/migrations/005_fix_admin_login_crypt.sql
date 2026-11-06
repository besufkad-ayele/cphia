create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_admin_login(p_email text, p_password text)
returns table(id uuid, email text, full_name text, role text, status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select a.id, a.email, a.full_name, a.role, a.status
  from public.admins a
  where lower(a.email) = lower(btrim(p_email))
    and a.status = 'active'
    and a.password_hash is not null
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;
end;
$$;

do $$
declare
  v_email text := 'ayebesufkad@gmail.com';
  v_password text := 'beseAye3...';
begin
  insert into public.admins (id, email, full_name, role, status, password_hash)
  values (gen_random_uuid(), v_email, 'Super Admin', 'super_admin', 'active', extensions.crypt(v_password, extensions.gen_salt('bf')))
  on conflict (email) do update
    set role = 'super_admin',
        status = 'active',
        full_name = coalesce(public.admins.full_name, 'Super Admin'),
        password_hash = extensions.crypt(v_password, extensions.gen_salt('bf'));
end;
$$;
