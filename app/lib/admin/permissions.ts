export const ADMIN_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', detail: 'Cohort totals and who is on duty today', href: '/admin' },
  { key: 'volunteers', label: 'Volunteers', detail: 'Review registrations and export the cohort', href: '/admin/volunteers' },
  { key: 'floor', label: 'Live floor', detail: 'Live present counts by team and shift', href: '/admin/floor' },
  { key: 'attendance', label: 'Attendance', detail: 'Mark present, late, absent, or excused', href: '/admin/attendance' },
  { key: 'shifts', label: 'Shifts', detail: 'Build the duty roster and capacities', href: '/admin/shifts' },
  { key: 'teams', label: 'Floor teams', detail: 'Protocol, marshal, registration crews and supervisors', href: '/admin/teams' },
  { key: 'cohorts', label: 'Events & cohorts', detail: 'Venues, dates, and cohort detail', href: '/admin/cohorts' },
  { key: 'forms', label: 'Forms', detail: 'Build briefings, checklists, and responses', href: '/admin/forms' },
  { key: 'users', label: 'Team', detail: 'Create admin accounts and assign a role', href: '/admin/users' },
  { key: 'roles', label: 'Roles', detail: 'Choose which modules a role can open', href: '/admin/roles' },
] as const;

export type FeatureKey = (typeof ADMIN_FEATURES)[number]['key'];

/**
 * Mobile dock modules (Attendance is a floating right-edge flag, not a dock tab).
 * Prefers Live floor over Floor teams.
 */
export const MOBILE_DOCK_PRIORITY: FeatureKey[] = [
  'dashboard',
  'volunteers',
  'floor',
  'shifts',
  'teams',
  'cohorts',
  'forms',
  'users',
  'roles',
];

export type CapabilityDef = {
  key: string;
  label: string;
  detail: string;
};

/** Dashboard widgets — granted when module is on unless narrowed. */
export const DASHBOARD_WIDGETS = [
  { key: 'dashboard.metrics', label: 'Status cards', detail: 'Totals, pending, approved, floor counts' },
  { key: 'dashboard.gender', label: 'Gender comparison', detail: 'Overall gender pie chart and table' },
  { key: 'dashboard.gender_sector', label: 'Gender by sector', detail: 'Stacked gender bars by sector' },
  { key: 'dashboard.age', label: 'Age comparison', detail: 'Age buckets and mean/median' },
  { key: 'dashboard.education', label: 'Education comparison', detail: 'Education mix by gender' },
  { key: 'dashboard.sectors', label: 'Sector lists', detail: 'Sector and health sub-sector lists' },
  { key: 'dashboard.floor', label: "Today's floor", detail: 'Shifts and check-ins today' },
  { key: 'dashboard.recent', label: 'Recent registrations', detail: 'Latest volunteer submissions' },
] as const satisfies readonly CapabilityDef[];

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]['key'];

export const VOLUNTEER_ACCESS_LEVELS = [
  {
    key: 'volunteers.access.read',
    label: 'Read only',
    detail: 'View list and popup details. No edits, deletes, or exports.',
  },
  {
    key: 'volunteers.access.update',
    label: 'Read & update',
    detail: 'View plus status changes and record edits. No create/delete/export/assets.',
  },
  {
    key: 'volunteers.access.full',
    label: 'Full CRUD',
    detail: 'Create, read, update, delete, export, and download assets.',
  },
] as const satisfies readonly CapabilityDef[];

export type VolunteerAccessKey = (typeof VOLUNTEER_ACCESS_LEVELS)[number]['key'];
export type VolunteerAccess = 'read' | 'update' | 'full' | 'none';

/** Nested capabilities for every module except volunteers (access levels) and dashboard (widgets above). */
export const MODULE_CAPABILITIES = {
  teams: [
    { key: 'teams.view', label: 'View teams', detail: 'Open the team list and roster' },
    { key: 'teams.create', label: 'Create teams', detail: 'Add new floor teams under an event' },
    { key: 'teams.edit', label: 'Edit teams', detail: 'Rename, set supervisor, archive' },
    { key: 'teams.members', label: 'Manage members', detail: 'Add, remove, and set zone captains' },
    { key: 'teams.delete', label: 'Delete teams', detail: 'Remove a team and its memberships' },
  ],
  attendance: [
    { key: 'attendance.view', label: 'View sheets', detail: 'Open shift attendance lists' },
    { key: 'attendance.mark', label: 'Mark attendance', detail: 'Set present, late, absent, or excused' },
    { key: 'attendance.submit', label: 'Submit sheet', detail: 'Submit a completed sheet for review' },
    { key: 'attendance.verify', label: 'Verify sheet', detail: 'Admin lock of a team or training sheet' },
    { key: 'attendance.reopen', label: 'Reopen sheet', detail: 'Unlock a verified sheet for corrections' },
    { key: 'attendance.reports', label: 'Reports & export', detail: 'Open attendance reports and download exports' },
  ],
  shifts: [
    { key: 'shifts.view', label: 'View shifts', detail: 'See the duty roster' },
    { key: 'shifts.create', label: 'Create shifts', detail: 'Add training or ops duty blocks' },
    { key: 'shifts.edit', label: 'Edit shifts', detail: 'Change times, team, capacity, notes' },
    { key: 'shifts.delete', label: 'Delete shifts', detail: 'Remove a shift and its marks' },
  ],
  floor: [
    { key: 'floor.view', label: 'View live board', detail: 'See live present / gap counts' },
    { key: 'floor.teams', label: 'Team rollups', detail: 'Per-team totals on the live board' },
  ],
  cohorts: [
    { key: 'cohorts.view', label: 'View events', detail: 'Open event / cohort list and detail' },
    { key: 'cohorts.create', label: 'Create events', detail: 'Add a new event / cohort' },
    { key: 'cohorts.edit', label: 'Edit events', detail: 'Change venue, dates, status, capacity' },
    { key: 'cohorts.delete', label: 'Delete events', detail: 'Remove an event / cohort' },
  ],
  forms: [
    { key: 'forms.view', label: 'View forms', detail: 'Open form list and design' },
    { key: 'forms.create', label: 'Create forms', detail: 'Start a new briefing or checklist' },
    { key: 'forms.edit', label: 'Edit forms', detail: 'Change fields, status, and cohort link' },
    { key: 'forms.responses', label: 'View responses', detail: 'Read submitted answers' },
    { key: 'forms.delete', label: 'Delete forms', detail: 'Remove a form and its responses' },
  ],
  users: [
    { key: 'users.view', label: 'View accounts', detail: 'See admin team accounts' },
    { key: 'users.create', label: 'Create accounts', detail: 'Invite or create an admin user' },
    { key: 'users.edit', label: 'Edit accounts', detail: 'Change name, role, status, password' },
    { key: 'users.delete', label: 'Disable / remove', detail: 'Disable or delete an admin account' },
  ],
  roles: [
    { key: 'roles.view', label: 'View roles', detail: 'See role templates and access' },
    { key: 'roles.create', label: 'Create roles', detail: 'Add a new access template' },
    { key: 'roles.edit', label: 'Edit roles', detail: 'Change modules and detail permissions' },
    { key: 'roles.delete', label: 'Delete roles', detail: 'Remove a non-system role' },
  ],
} as const satisfies Record<string, readonly CapabilityDef[]>;

export type ModuleCapabilityKey =
  | (typeof MODULE_CAPABILITIES.teams)[number]['key']
  | (typeof MODULE_CAPABILITIES.attendance)[number]['key']
  | (typeof MODULE_CAPABILITIES.shifts)[number]['key']
  | (typeof MODULE_CAPABILITIES.floor)[number]['key']
  | (typeof MODULE_CAPABILITIES.cohorts)[number]['key']
  | (typeof MODULE_CAPABILITIES.forms)[number]['key']
  | (typeof MODULE_CAPABILITIES.users)[number]['key']
  | (typeof MODULE_CAPABILITIES.roles)[number]['key'];

export type PermissionKey = FeatureKey | DashboardWidgetKey | VolunteerAccessKey | ModuleCapabilityKey;

const FEATURE_KEYS = new Set<string>(ADMIN_FEATURES.map((feature) => feature.key));
const DETAIL_DEFS: CapabilityDef[] = [
  ...DASHBOARD_WIDGETS,
  ...VOLUNTEER_ACCESS_LEVELS,
  ...Object.values(MODULE_CAPABILITIES).flat(),
];
const PERMISSION_KEYS = new Set<string>([
  ...FEATURE_KEYS,
  ...DETAIL_DEFS.map((item) => item.key),
]);

export function isFeature(value: string): value is FeatureKey {
  return FEATURE_KEYS.has(value);
}

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEYS.has(value);
}

export function allFeatureKeys(): FeatureKey[] {
  return ADMIN_FEATURES.map((feature) => feature.key);
}

export function detailsForFeature(feature: FeatureKey): CapabilityDef[] {
  if (feature === 'dashboard') return [...DASHBOARD_WIDGETS];
  if (feature === 'volunteers') return [...VOLUNTEER_ACCESS_LEVELS];
  if (feature in MODULE_CAPABILITIES) {
    return [...MODULE_CAPABILITIES[feature as keyof typeof MODULE_CAPABILITIES]];
  }
  return [];
}

export function allPermissionKeys(): PermissionKey[] {
  return [
    ...allFeatureKeys(),
    ...DETAIL_DEFS.map((item) => item.key as PermissionKey),
  ];
}

/** Defaults when a module is turned on with no nested choices yet. */
export function defaultDetailsForFeature(feature: FeatureKey): PermissionKey[] {
  if (feature === 'volunteers') return ['volunteers.access.full'];
  return detailsForFeature(feature).map((item) => item.key as PermissionKey);
}

export function defaultPermissions(role: string): PermissionKey[] {
  if (role === 'super_admin') return allPermissionKeys();
  const modules: FeatureKey[] = ['dashboard', 'volunteers', 'floor', 'attendance', 'shifts', 'teams', 'cohorts', 'forms'];
  return [
    ...modules,
    ...modules.flatMap((feature) => defaultDetailsForFeature(feature)),
  ];
}

export function hasFeature(session: { role: string; permissions?: readonly string[] }, feature: FeatureKey) {
  if (session.role === 'super_admin') return true;
  const permissions = session.permissions ?? [];
  if (permissions.includes(feature)) return true;
  return permissions.some((item) => item.startsWith(`${feature}.`));
}

/** Map an admin console path to the module that must be granted. */
export function featureForAdminPath(pathname: string): FeatureKey | null {
  const path = pathname.replace(/\/+$/, '') || '/admin';
  if (path === '/admin') return 'dashboard';

  const modules = ADMIN_FEATURES
    .filter((feature) => feature.href !== '/admin')
    .slice()
    .sort((a, b) => b.href.length - a.href.length);

  for (const feature of modules) {
    if (path === feature.href || path.startsWith(`${feature.href}/`)) return feature.key;
  }
  return null;
}

/** First module route the session can open (nav order). Null if none are granted. */
export function firstAllowedAdminHref(session: { role: string; permissions?: readonly string[] }) {
  for (const feature of ADMIN_FEATURES) {
    if (hasFeature(session, feature.key)) return feature.href;
  }
  return null;
}

function moduleDetailKeys(permissions: readonly string[], feature: FeatureKey) {
  return permissions.filter((item) => item.startsWith(`${feature}.`));
}

/**
 * Nested capability check.
 * Legacy roles with only the module key (no detail keys) keep full access for that module.
 */
export function hasCapability(
  session: { role: string; permissions?: readonly string[] },
  capability: PermissionKey,
) {
  if (session.role === 'super_admin') return true;
  const permissions = session.permissions ?? [];
  if (permissions.includes(capability)) return true;

  const feature = capability.split('.')[0] as FeatureKey;
  if (!isFeature(feature) || !hasFeature(session, feature)) return false;

  const details = moduleDetailKeys(permissions, feature);
  if (!details.length) return true; // legacy full module access
  return details.includes(capability);
}

export function volunteerAccess(session: {
  role: string;
  permissions?: readonly string[];
}): VolunteerAccess {
  if (session.role === 'super_admin') return 'full';
  if (!hasFeature(session, 'volunteers')) return 'none';
  const permissions = session.permissions ?? [];
  if (permissions.includes('volunteers.access.full')) return 'full';
  if (permissions.includes('volunteers.access.update')) return 'update';
  if (permissions.includes('volunteers.access.read')) return 'read';
  if (!moduleDetailKeys(permissions, 'volunteers').length) return 'full';
  return 'read';
}

export function canVolunteerRead(session: { role: string; permissions?: readonly string[] }) {
  return volunteerAccess(session) !== 'none';
}

export function canVolunteerUpdate(session: { role: string; permissions?: readonly string[] }) {
  const access = volunteerAccess(session);
  return access === 'update' || access === 'full';
}

export function canVolunteerManage(session: { role: string; permissions?: readonly string[] }) {
  return volunteerAccess(session) === 'full';
}

export function cleanPermissions(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<PermissionKey>();
  for (const item of value) {
    if (typeof item === 'string' && isPermissionKey(item)) unique.add(item);
  }

  for (const feature of ADMIN_FEATURES) {
    if (!unique.has(feature.key)) continue;
    const hasDetails = [...unique].some((item) => item.startsWith(`${feature.key}.`));
    if (!hasDetails) {
      for (const detail of defaultDetailsForFeature(feature.key)) unique.add(detail);
    }
  }

  for (const item of [...unique]) {
    if (!item.includes('.')) continue;
    const feature = item.split('.')[0];
    if (feature && isFeature(feature)) unique.add(feature);
  }

  const accessKeys = VOLUNTEER_ACCESS_LEVELS.map((item) => item.key).filter((key) => unique.has(key));
  if (unique.has('volunteers')) {
    if (accessKeys.length === 0) unique.add('volunteers.access.full');
    if (accessKeys.length > 1) {
      for (const key of accessKeys) unique.delete(key);
      unique.add(
        accessKeys.includes('volunteers.access.full')
          ? 'volunteers.access.full'
          : accessKeys.includes('volunteers.access.update')
            ? 'volunteers.access.update'
            : 'volunteers.access.read',
      );
    }
  }

  return [...unique];
}

export type AccessDraft = {
  modules: FeatureKey[];
  /** Selected detail keys for every module (dashboard widgets + module caps). Volunteers use volunteerAccess. */
  details: PermissionKey[];
  volunteerAccess: VolunteerAccessKey;
};

/** Normalize UI selections into a stored permissions array. */
export function buildPermissions(input: AccessDraft): PermissionKey[] {
  const next = new Set<PermissionKey>();
  for (const module of input.modules) {
    next.add(module);
    if (module === 'volunteers') {
      next.add(input.volunteerAccess);
      continue;
    }
    const allowed = new Set(detailsForFeature(module).map((item) => item.key));
    for (const detail of input.details) {
      if (allowed.has(detail)) next.add(detail);
    }
  }
  return cleanPermissions([...next]);
}

export function parsePermissionState(permissions: readonly string[]): AccessDraft {
  const modules = ADMIN_FEATURES.map((feature) => feature.key).filter(
    (key) => permissions.includes(key) || permissions.some((item) => item.startsWith(`${key}.`)),
  ) as FeatureKey[];

  const details: PermissionKey[] = [];
  for (const feature of modules) {
    if (feature === 'volunteers') continue;
    const defs = detailsForFeature(feature);
    const selected = defs
      .map((item) => item.key as PermissionKey)
      .filter((key) => permissions.includes(key));
    if (selected.length) {
      details.push(...selected);
    } else if (permissions.includes(feature) || permissions.some((item) => item.startsWith(`${feature}.`))) {
      // Module on without explicit details → full defaults in the editor.
      details.push(...defaultDetailsForFeature(feature));
    }
  }

  let volunteerAccess: VolunteerAccessKey = 'volunteers.access.full';
  if (permissions.includes('volunteers.access.read')) volunteerAccess = 'volunteers.access.read';
  else if (permissions.includes('volunteers.access.update')) volunteerAccess = 'volunteers.access.update';
  else if (permissions.includes('volunteers.access.full')) volunteerAccess = 'volunteers.access.full';

  return { modules, details, volunteerAccess };
}
