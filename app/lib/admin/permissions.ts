export const ADMIN_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', detail: 'Cohort totals and who is on duty today', href: '/admin' },
  { key: 'volunteers', label: 'Volunteers', detail: 'Review registrations and export the cohort', href: '/admin/volunteers' },
  { key: 'attendance', label: 'Attendance', detail: 'Mark present, late, absent, or excused', href: '/admin/attendance' },
  { key: 'shifts', label: 'Shifts', detail: 'Build the duty roster and capacities', href: '/admin/shifts' },
  { key: 'cohorts', label: 'Events & cohorts', detail: 'Venues, dates, and cohort detail', href: '/admin/cohorts' },
  { key: 'forms', label: 'Forms', detail: 'Build briefings, checklists, and responses', href: '/admin/forms' },
  { key: 'users', label: 'Team', detail: 'Create admin accounts and assign a role', href: '/admin/users' },
  { key: 'roles', label: 'Roles', detail: 'Choose which modules a role can open', href: '/admin/roles' },
] as const;

export type FeatureKey = (typeof ADMIN_FEATURES)[number]['key'];

const FEATURE_KEYS = new Set<string>(ADMIN_FEATURES.map((feature) => feature.key));

export function isFeature(value: string): value is FeatureKey {
  return FEATURE_KEYS.has(value);
}

export function allFeatureKeys(): FeatureKey[] {
  return ADMIN_FEATURES.map((feature) => feature.key);
}

export function defaultPermissions(role: string): FeatureKey[] {
  if (role === 'super_admin') return allFeatureKeys();
  return ['dashboard', 'volunteers', 'attendance', 'shifts', 'cohorts', 'forms'];
}

export function hasFeature(session: { role: string; permissions?: readonly string[] }, feature: FeatureKey) {
  if (session.role === 'super_admin') return true;
  return (session.permissions ?? []).includes(feature);
}

export function cleanPermissions(value: unknown): FeatureKey[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<FeatureKey>();
  for (const item of value) {
    if (typeof item === 'string' && isFeature(item)) unique.add(item);
  }
  return [...unique];
}
