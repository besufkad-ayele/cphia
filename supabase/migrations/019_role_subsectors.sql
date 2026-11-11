-- Duty / role areas for Ethiopian Youth Council, U-Report, and Serve Global volunteers.
alter table public.registrations
  add column if not exists role_subsectors text[] not null default '{}';

comment on column public.registrations.role_subsectors is
  'Assigned duty areas for Ethiopian Youth Council, U-Report, and Serve Global (multi-select).';
