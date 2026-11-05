create extension if not exists pgcrypto;

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  device_token_hash text not null unique,
  fingerprint_hash text,
  registration_id uuid,
  first_seen_at timestamptz not null default now(),
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  registration_id text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  full_name_amharic text not null,
  sex text not null check (sex in ('Male', 'Female')),
  age integer not null check (age between 18 and 70),
  nationality text not null default 'Ethiopia',
  fan_number text not null unique,
  second_id_type text,
  second_id_number text,
  photo_path text,
  phone text not null,
  phone_is_whatsapp boolean not null default true,
  whatsapp_number text,
  no_whatsapp boolean not null default false,
  email text not null,
  residence_region text not null,
  residence_detail text not null,
  profession text,
  education_level text not null,
  emergency_name text not null,
  emergency_phone text not null,
  emergency_relationship text not null,
  sector text not null,
  health_subsectors text[] not null default '{}',
  ui_language text not null default 'en',
  idempotency_key uuid not null unique,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  device_token_hash text,
  device_fingerprint_hash text,
  device_flag text default 'none',
  created_at timestamptz not null default now(),
  unique (device_token_hash)
);

create table if not exists registration_languages (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  language_group text not null check (language_group in ('ethiopian', 'un', 'other')),
  language text not null,
  proficiency text not null,
  created_at timestamptz not null default now()
);

create table if not exists admins (
  id uuid primary key,
  email text not null unique,
  full_name text,
  role text not null default 'admin' check (role in ('super_admin', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  approved_by uuid
);

create table if not exists export_presets (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  name text not null,
  columns jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_registrations_email_lower on registrations (lower(email));
create index if not exists idx_registrations_phone_norm on registrations (regexp_replace(phone, '[^0-9+]','','g'));
create index if not exists idx_registrations_fan on registrations (fan_number);
create index if not exists idx_registrations_device on registrations (device_token_hash);
create index if not exists idx_registrations_created_at on registrations (created_at desc);
create index if not exists idx_registrations_sector on registrations (sector);
create index if not exists idx_registrations_sex on registrations (sex);
create index if not exists idx_registration_languages_registration on registration_languages (registration_id);
create index if not exists idx_registration_languages_language on registration_languages (language);
create index if not exists idx_devices_registration on devices (registration_id);
create index if not exists idx_devices_fingerprint on devices (fingerprint_hash);

alter table registrations enable row level security;
alter table registration_languages enable row level security;
alter table devices enable row level security;
alter table admins enable row level security;
alter table export_presets enable row level security;
alter table audit_log enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all functions in schema public from anon;
revoke all on all functions in schema public from authenticated;

create sequence if not exists registration_sequence start 1 increment 1;

create or replace function register_volunteer(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id text;
  v_id uuid;
  v_photo_path text;
  v_device_token_hash text;
  v_device_fingerprint_hash text;
  v_device_token text;
  v_row_count int;
  v_lang jsonb;
begin
  if payload is null then
    raise exception 'empty payload';
  end if;

  v_device_token_hash := payload->>'device_token_hash';
  v_device_fingerprint_hash := payload->>'device_fingerprint_hash';

  if v_device_token_hash is not null and exists (
    select 1 from registrations where device_token_hash = v_device_token_hash
  ) then
    return jsonb_build_object('error', 'DUPLICATE_DEVICE');
  end if;

  if exists (select 1 from registrations where lower(email) = lower(payload->>'email')) then
    return jsonb_build_object('error', 'DUPLICATE_EMAIL');
  end if;

  if exists (select 1 from registrations where fan_number = payload->>'fan_number') then
    return jsonb_build_object('error', 'DUPLICATE_FAN');
  end if;

  if exists (select 1 from registrations where regexp_replace(phone, '[^0-9+]', '', 'g') = regexp_replace(payload->>'phone', '[^0-9+]', '', 'g')) then
    return jsonb_build_object('error', 'DUPLICATE_PHONE');
  end if;

  v_registration_id := 'CPHIA-26-' || lpad(nextval('registration_sequence')::text, 6, '0');

  insert into registrations (
    registration_id,
    first_name,
    middle_name,
    last_name,
    full_name_amharic,
    sex,
    age,
    nationality,
    fan_number,
    second_id_type,
    second_id_number,
    photo_path,
    phone,
    phone_is_whatsapp,
    whatsapp_number,
    no_whatsapp,
    email,
    residence_region,
    residence_detail,
    profession,
    education_level,
    emergency_name,
    emergency_phone,
    emergency_relationship,
    sector,
    health_subsectors,
    ui_language,
    idempotency_key,
    device_token_hash,
    device_fingerprint_hash,
    device_flag,
    email_status
  ) values (
    v_registration_id,
    payload->>'first_name',
    payload->>'middle_name',
    payload->>'last_name',
    payload->>'full_name_amharic',
    payload->>'sex',
    (payload->>'age')::int,
    coalesce(payload->>'nationality', 'Ethiopia'),
    payload->>'fan_number',
    payload->>'second_id_type',
    payload->>'second_id_number',
    payload->>'photo_path',
    payload->>'phone',
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
    coalesce((payload->'health_subsectors')::text[], '{}'),
    coalesce(payload->>'ui_language', 'en'),
    payload->>'idempotency_key',
    v_device_token_hash,
    v_device_fingerprint_hash,
    case when v_device_fingerprint_hash is not null then 'possible_duplicate' else 'none' end,
    'pending'
  ) returning id into v_id;

  for v_lang in select * from jsonb_array_elements(coalesce(payload->'languages', '[]'::jsonb))
  loop
    insert into registration_languages (registration_id, language_group, language, proficiency)
    values (
      v_id,
      v_lang->>'group',
      v_lang->>'language',
      v_lang->>'proficiency'
    );
  end loop;

  return jsonb_build_object('registrationId', v_registration_id, 'id', v_id);
exception
  when unique_violation then
    if sqlstate = '23505' then
      if exists (select 1 from registrations where lower(email) = lower(payload->>'email')) then
        return jsonb_build_object('error', 'DUPLICATE_EMAIL');
      elsif exists (select 1 from registrations where fan_number = payload->>'fan_number') then
        return jsonb_build_object('error', 'DUPLICATE_FAN');
      elsif v_device_token_hash is not null and exists (select 1 from registrations where device_token_hash = v_device_token_hash) then
        return jsonb_build_object('error', 'DUPLICATE_DEVICE');
      else
        return jsonb_build_object('error', 'DUPLICATE');
      end if;
    end if;
    return jsonb_build_object('error', 'DB_ERROR');
end;
$$;

create or replace function ensure_device_claim(device_token text, device_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into devices (device_token_hash, fingerprint_hash, user_agent)
  values (digest(device_token, 'sha256')::text, device_fingerprint, current_setting('user_agent', true))
  on conflict (device_token_hash) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;
