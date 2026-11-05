do $$
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