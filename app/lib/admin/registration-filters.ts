import { HEALTH_SUBSECTORS, SECTORS } from '@cphia/shared/constants';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveAdminStatus } from './status';
import type { RegistrationMetrics } from './types';

export type RegistrationFilterParams = {
  status?: string | null;
  search?: string;
  sector?: string | null;
  subsector?: string | null;
};

export function parseSector(value: string | null) {
  if (!value) return null;
  return (SECTORS as readonly string[]).includes(value) ? value : null;
}

export function parseSubsector(value: string | null) {
  if (!value) return null;
  return (HEALTH_SUBSECTORS as readonly string[]).includes(value) ? value : null;
}

export function sanitizeSearch(value: string) {
  return value.replace(/[,.%()\\]/g, ' ').trim().slice(0, 80);
}

type FilterableQuery = {
  eq: (column: string, value: unknown) => FilterableQuery;
  contains: (column: string, value: unknown) => FilterableQuery;
  or: (filters: string) => FilterableQuery;
};

export function applyRegistrationFilters<T extends FilterableQuery>(
  query: T,
  filters: RegistrationFilterParams,
  options?: { includeStatus?: boolean },
): T {
  let next = query;
  if (options?.includeStatus !== false && filters.status) {
    next = next.eq('review_status', filters.status) as T;
  }
  if (filters.sector) {
    next = next.eq('sector', filters.sector) as T;
  }
  if (filters.subsector) {
    next = next.contains('health_subsectors', [filters.subsector]) as T;
  }
  if (filters.search) {
    const tokens = filters.search.split(/\s+/).filter(Boolean);
    const fields = [
      'first_name',
      'middle_name',
      'last_name',
      'email',
      'phone',
      'secondary_phone',
      'fan_number',
      'registration_id',
    ];
    // Match full phrase on each field, and also each token (supports “name father grandfather”)
    const clauses = [
      ...fields.map((field) => `${field}.ilike.%${filters.search}%`),
      ...tokens.flatMap((token) =>
        ['first_name', 'middle_name', 'last_name'].map((field) => `${field}.ilike.%${token}%`),
      ),
    ];
    next = next.or([...new Set(clauses)].join(',')) as T;
  }
  return next;
}

export function applyNameSort<T extends { order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => T }>(
  query: T,
) {
  return query
    .order('first_name', { ascending: true })
    .order('middle_name', { ascending: true })
    .order('last_name', { ascending: true });
}

export function matchesVolunteerSearch(
  row: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
    secondaryPhone?: string;
    fanNumber?: string;
    registrationId?: string;
  },
  search: string,
) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.firstName,
    row.middleName,
    row.lastName,
    row.name,
    row.email,
    row.phone,
    row.secondaryPhone,
    row.fanNumber,
    row.registrationId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export async function registrationStatusMetrics(
  supabase: SupabaseClient,
  filters: Omit<RegistrationFilterParams, 'status'>,
): Promise<RegistrationMetrics> {
  let query = supabase.from('registrations').select('review_status, email_status, device_flag');
  query = applyRegistrationFilters(query as never, filters, { includeStatus: false }) as typeof query;
  const { data } = await query;
  return (data ?? []).reduce(
    (acc, row) => {
      const value = deriveAdminStatus(row.review_status, row.email_status, row.device_flag);
      acc.total += 1;
      acc[value] += 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 } satisfies RegistrationMetrics,
  );
}

export function sectorBreakdown(
  rows: Array<{ sector: string | null; health_subsectors?: string[] | null }>,
) {
  const sectors = new Map<string, number>();
  const subsectors = new Map<string, number>();
  for (const row of rows) {
    const sector = row.sector || 'Other';
    sectors.set(sector, (sectors.get(sector) ?? 0) + 1);
    for (const item of row.health_subsectors ?? []) {
      subsectors.set(item, (subsectors.get(item) ?? 0) + 1);
    }
  }
  return {
    sectors: [...sectors.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    subsectors: [...subsectors.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
