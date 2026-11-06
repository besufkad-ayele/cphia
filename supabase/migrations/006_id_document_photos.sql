alter table public.registrations
  add column if not exists fan_photo_path text,
  add column if not exists second_id_photo_path text;

create or replace function register_volunteer(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id text;
  v_id uuid;
  v_device_token_hash text;
  v_device_fingerprint_hash text;
  v_fan text;
  v_lang jsonb;
  v_health text[];
begin
  if payload is null then
    raise exception 'empty payload';
  end if;

  v_device_token_hash := nullif(payload->>'device_token_hash', '');
  v_device_fingerprint_hash := nullif(payload->>'device_fingerprint_hash', '');
  v_fan := regexp_replace(coalesce(payload->>'fan_number', ''), '\s', '', 'g');

  if v_fan is null or length(v_fan) <> 16 or v_fan !~ '^[0-9]+$' then
    return jsonb_build_object('error', 'INVALID_FAN');
  end if;

  if v_device_token_hash is not null and exists (
    select 1 from registrations where device_token_hash = v_device_token_hash
  ) then
    return jsonb_build_object('error', 'DUPLICATE_DEVICE');
  end if;

  if exists (select 1 from registrations where lower(email) = lower(payload->>'email')) then
    return jsonb_build_object('error', 'DUPLICATE_EMAIL');
  end if;

  if exists (select 1 from registrations where fan_number = v_fan) then
    return jsonb_build_object('error', 'DUPLICATE_FAN');
  end if;

  if exists (
    select 1 from registrations
    where regexp_replace(phone, '[^0-9+]', '', 'g') = regexp_replace(payload->>'phone', '[^0-9+]', '', 'g')
  ) then
    return jsonb_build_object('error', 'DUPLICATE_PHONE');
  end if;

  select coalesce(array_agg(value), '{}'::text[])
    into v_health
  from jsonb_array_elements_text(coalesce(payload->'health_subsectors', '[]'::jsonb)) as value;

  v_registration_id := 'CPHIA-26-' || lpad(nextval('registration_sequence')::text, 6, '0');

  insert into registrations (
    registration_id, first_name, middle_name, last_name, full_name_amharic, sex, age, nationality,
    fan_number, second_id_type, second_id_number, photo_path, fan_photo_path, second_id_photo_path,
    phone, secondary_phone, phone_is_whatsapp,
    whatsapp_number, no_whatsapp, email, residence_region, residence_detail, profession, education_level,
    emergency_name, emergency_phone, emergency_relationship, sector, health_subsectors, ui_language,
    idempotency_key, device_token_hash, device_fingerprint_hash, device_flag, email_status, review_status,
    bank_name, bank_account_name, bank_account_number, ureport_registered, ureport_screenshot_path, cohort
  ) values (
    v_registration_id,
    payload->>'first_name',
    payload->>'middle_name',
    payload->>'last_name',
    coalesce(nullif(payload->>'full_name_amharic', ''), concat_ws(' ', payload->>'first_name', payload->>'last_name')),
    payload->>'sex',
    (payload->>'age')::int,
    coalesce(payload->>'nationality', 'Ethiopian'),
    v_fan,
    payload->>'second_id_type',
    payload->>'second_id_number',
    payload->>'photo_path',
    payload->>'fan_photo_path',
    payload->>'second_id_photo_path',
    payload->>'phone',
    nullif(payload->>'secondary_phone', ''),
    coalesce((payload->>'phone_is_whatsapp')::boolean, true),
    payload->>'whatsapp_number',
    coalesce((payload->>'no_whatsapp')::boolean, false),
    lower(payload->>'email'),
    payload->>'residence_region',
    payload->>'residence_detail',
    payload->>'profession',
    payload->>'education_level',
    payload->>'emergency_name',
    payload->>'emergency_phone',
    payload->>'emergency_relationship',
    payload->>'sector',
    coalesce(v_health, '{}'::text[]),
    coalesce(payload->>'ui_language', 'en'),
    (payload->>'idempotency_key')::uuid,
    v_device_token_hash,
    v_device_fingerprint_hash,
    case when v_device_fingerprint_hash is not null then 'possible_duplicate' else 'none' end,
    'pending',
    'pending',
    payload->>'bank_name',
    payload->>'bank_account_name',
    payload->>'bank_account_number',
    coalesce((payload->>'ureport_registered')::boolean, false),
    payload->>'ureport_screenshot_path',
    'CPHIA-26'
  ) returning id into v_id;

  for v_lang in select * from jsonb_array_elements(coalesce(payload->'languages', '[]'::jsonb))
  loop
    insert into registration_languages (registration_id, language_group, language, proficiency)
    values (v_id, v_lang->>'group', v_lang->>'language', v_lang->>'proficiency');
  end loop;

  return jsonb_build_object('registrationId', v_registration_id, 'id', v_id);
exception
  when unique_violation then
    if exists (select 1 from registrations where lower(email) = lower(payload->>'email')) then
      return jsonb_build_object('error', 'DUPLICATE_EMAIL');
    elsif exists (select 1 from registrations where fan_number = v_fan) then
      return jsonb_build_object('error', 'DUPLICATE_FAN');
    elsif v_device_token_hash is not null and exists (select 1 from registrations where device_token_hash = v_device_token_hash) then
      return jsonb_build_object('error', 'DUPLICATE_DEVICE');
    else
      return jsonb_build_object('error', 'DUPLICATE');
    end if;
end;
$$;
