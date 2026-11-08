const PREFIX = 'cphia.admin.overview.v1:';

export function overviewCacheKey(sector: string, subsector: string) {
  const date = new Date().toLocaleDateString('en-CA');
  return `${PREFIX}${date}|${sector || 'all'}|${subsector || 'all'}`;
}

export function readOverviewCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeOverviewCache(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — ignore; live fetch still works.
  }
}
