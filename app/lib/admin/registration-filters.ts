import {
  HEALTH_SUBSECTORS,
  isKnownSubsector,
  normalizeSector,
  subsectorOptionsForSector,
} from '@cphia/shared/constants';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveAdminStatus } from './status';
import type { RegistrationMetrics } from './types';

export type RegistrationFilterParams = {
  status?: string | null;
  search?: string;
  /** Single sector (legacy). Prefer `sectors` when multiple are selected. */
  sector?: string | null;
  /** One or more sectors. Empty / omitted = all sectors. */
  sectors?: string[] | null;
  subsector?: string | null;
};

export function parseSector(value: string | null) {
  return normalizeSector(value);
}

/** Parse `sectors=Health,Tourism` or a single `sector=` value into canonical labels. */
export function parseSectors(
  rawSectors: string | null | undefined,
  rawSector?: string | null,
): string[] {
  const fromList = String(rawSectors || '')
    .split(',')
    .map((item) => parseSector(item.trim()))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (fromList.length) return [...new Set(fromList)];
  const single = parseSector(rawSector ?? null);
  return single ? [single] : [];
}

export function parseSubsector(value: string | null) {
  if (!value) return null;
  return isKnownSubsector(value) ? value : null;
}

export function subsectorStorageColumn(subsector: string): 'health_subsectors' | 'role_subsectors' {
  if ((HEALTH_SUBSECTORS as readonly string[]).includes(subsector)) return 'health_subsectors';
  return 'role_subsectors';
}

export function sanitizeSearch(value: string) {
  return value.replace(/[,.%()\\]/g, ' ').trim().slice(0, 80);
}

/** Collapse punctuation so CPHIA-26-123, CPHIA 26 123, and 123 all compare cleanly. */
export function normalizeSearchKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Spellings that may still exist on older registration rows for one canonical sector. */
export function sectorFilterValues(canonical: string) {
  const normalized = normalizeSector(canonical) || canonical;
  const variants = new Set<string>([normalized]);
  if (normalized === 'U-Report') {
    variants.add('u-report');
    variants.add('U-report');
    variants.add('ureport');
    variants.add('U Report');
  }
  if (normalized === 'Serve Global') {
    variants.add('serve global');
    variants.add('ServeGlobal');
  }
  if (normalized === 'Ethiopian Youth Council') {
    variants.add('ethiopian youth council');
    variants.add('Ethiopian Youth Councle');
    variants.add('Youth Council');
  }
  return [...variants];
}

type FilterableQuery = {
  eq: (column: string, value: unknown) => FilterableQuery;
  in: (column: string, values: unknown[]) => FilterableQuery;
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
  // Sector filter is exact: Transport = only sector Transport (not a Transport sub-category).
  // Multiple sectors use `.in(...)`. Sub-category is separate (U-Report + Transport assignment).
  const sectorList = (filters.sectors?.length
    ? filters.sectors
    : filters.sector
      ? [filters.sector]
      : [])
    .map((item) => normalizeSector(item) || item)
    .filter(Boolean);
  if (sectorList.length) {
    const variants = [...new Set(sectorList.flatMap((sector) => sectorFilterValues(sector)))];
    next = (variants.length === 1
      ? next.eq('sector', variants[0])
      : next.in('sector', variants)) as T;
  }
  if (filters.subsector) {
    next = next.contains(subsectorStorageColumn(filters.subsector), [filters.subsector]) as T;
  }
  if (filters.search) {
    const raw = filters.search.trim();
    const tokens = raw.split(/\s+/).filter(Boolean);
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
      ...fields.map((field) => `${field}.ilike.%${raw}%`),
      ...tokens.flatMap((token) =>
        ['first_name', 'middle_name', 'last_name', 'registration_id', 'fan_number', 'phone'].map(
          (field) => `${field}.ilike.%${token}%`,
        ),
      ),
    ];
    // UUID / internal id exact match when the query looks like one.
    if (/^[0-9a-f-]{8,}$/i.test(raw)) {
      clauses.push(`id.eq.${raw}`);
    }
    // Numeric / code tail of public IDs like CPHIA-26-369215
    const digits = raw.replace(/\D+/g, '');
    if (digits.length >= 4) {
      clauses.push(`registration_id.ilike.%${digits}%`);
    }
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
    id?: string;
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

  const identityFields = [row.id, row.registrationId, row.fanNumber, row.phone, row.secondaryPhone, row.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const identityCompact = identityFields.map(normalizeSearchKey).join(' ');
  const queryCompact = normalizeSearchKey(q);

  // Public ID / UUID / FAN / phone: match even with different spacing or hyphens.
  if (queryCompact.length >= 4 && identityCompact.includes(queryCompact)) return true;
  if (identityFields.some((field) => field.includes(q))) return true;

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
    row.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const haystackCompact = normalizeSearchKey(haystack);

  return q.split(/\s+/).every((token) => {
    if (haystack.includes(token)) return true;
    const compact = normalizeSearchKey(token);
    return compact.length > 0 && haystackCompact.includes(compact);
  });
}

/** PostgREST/Supabase usually hard-caps one response at 1000 rows. */
export const SUPABASE_ROW_PAGE = 1000;

type RangeQuery = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown; count?: number | null }>;
};

/**
 * Walk `.range()` pages until every matching row is loaded.
 * Use for admin index / export / metrics — never trust a single unbounded select.
 */
export async function fetchAllPaged<T>(
  buildQuery: () => RangeQuery,
  options?: { pageSize?: number; maxRows?: number },
): Promise<{ rows: T[]; total: number }> {
  const pageSize = options?.pageSize ?? SUPABASE_ROW_PAGE;
  const maxRows = options?.maxRows ?? 50000;
  const rows: T[] = [];
  let total = 0;
  let offset = 0;

  while (offset < maxRows) {
    const { data, error, count } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    if (typeof count === 'number') total = count;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
    if (total > 0 && rows.length >= total) break;
  }

  return { rows, total: total || rows.length };
}

export async function registrationStatusMetrics(
  supabase: SupabaseClient,
  filters: Omit<RegistrationFilterParams, 'status'>,
): Promise<RegistrationMetrics> {
  const { rows } = await fetchAllPaged<{
    review_status: string | null;
    email_status: string | null;
    device_flag: string | null;
  }>(() => {
    let query = supabase.from('registrations').select('review_status, email_status, device_flag', {
      count: 'exact',
    });
    query = applyRegistrationFilters(query as never, filters, { includeStatus: false }) as typeof query;
    return query as never;
  });

  return rows.reduce(
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
  rows: Array<{
    sector: string | null;
    health_subsectors?: string[] | null;
    role_subsectors?: string[] | null;
  }>,
) {
  const sectors = new Map<string, number>();
  const subsectors = new Map<string, number>();
  for (const row of rows) {
    const sector = row.sector || 'Other';
    sectors.set(sector, (sectors.get(sector) ?? 0) + 1);
    for (const item of [...(row.health_subsectors ?? []), ...(row.role_subsectors ?? [])]) {
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

export function subsectorFilterOptions(sector: string | null | undefined): readonly string[] {
  return subsectorOptionsForSector(sector);
}
