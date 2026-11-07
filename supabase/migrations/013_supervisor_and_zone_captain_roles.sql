-- Supervisor: desk login scoped to their own team attendance.
-- Zone captain: informational roster label only — not a desk login.

insert into public.ops_roles (key, name, description, permissions, is_system) values
  (
    'supervisor',
    'Floor supervisor',
    'Takes attendance for ops shifts on teams they supervise. Create an admin account with this role, then assign them as supervisor on the team.',
    array[
      'dashboard',
      'dashboard.metrics',
      'dashboard.floor',
      'teams',
      'teams.view',
      'attendance',
      'attendance.view',
      'attendance.mark',
      'attendance.submit',
      'shifts',
      'shifts.view',
      'floor',
      'floor.view',
      'floor.teams'
    ],
    false
  ),
  (
    'zone_captain',
    'Zone captain',
    'Informational only. Shown on the team roster. Do not create a desk login — promote volunteers to zone captain on the team page.',
    '{}'::text[],
    true
  )
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  is_system = excluded.is_system;
