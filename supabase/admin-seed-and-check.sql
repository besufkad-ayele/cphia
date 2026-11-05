-- =============================================================
-- Admin seed + data-check script for CPHIA
-- Run this in the Supabase SQL editor.
-- =============================================================

-- 1) Seed / upsert the super admin account
DO $$
declare
  v_email text := 'ayebesufkad@gmail.com';
  v_password text := 'beseAye3...';
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      '{}'::jsonb,
      now(),
      now()
    );
  else
    update auth.users
    set encrypted_password = crypt(v_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_user_id;
  end if;

  insert into public.admins (id, email, full_name, role, status)
  values (v_user_id, v_email, 'Super Admin', 'super_admin', 'active')
  on conflict (email) do update
  set id = excluded.id,
      role = 'super_admin',
      status = 'active';
end;
$$;

-- 2) Check the admin table
SELECT *
FROM public.admins
ORDER BY created_at DESC;

-- 3) Count admins by role/status
SELECT
  role,
  status,
  COUNT(*) AS count
FROM public.admins
GROUP BY role, status
ORDER BY role, status;

-- 4) List all public tables
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 5) Show row counts for the app tables
SELECT 'admins' AS table_name, COUNT(*) AS rows FROM public.admins
UNION ALL
SELECT 'devices', COUNT(*) FROM public.devices
UNION ALL
SELECT 'registrations', COUNT(*) FROM public.registrations
UNION ALL
SELECT 'registration_languages', COUNT(*) FROM public.registration_languages
UNION ALL
SELECT 'export_presets', COUNT(*) FROM public.export_presets
UNION ALL
SELECT 'audit_log', COUNT(*) FROM public.audit_log;

-- 6) Inspect all main data tables
SELECT * FROM public.devices ORDER BY created_at DESC LIMIT 100;
SELECT * FROM public.registrations ORDER BY created_at DESC LIMIT 100;
SELECT * FROM public.registration_languages ORDER BY created_at DESC LIMIT 100;
SELECT * FROM public.export_presets ORDER BY created_at DESC LIMIT 100;
SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 100;
