import { SECTORS } from '@cphia/shared/constants';

const ALLOWED = new Set<string>(SECTORS as readonly string[]);

/** Normalize multi-sector checklist from API body; keep legacy `sector` string in sync. */
export function parseShiftSectors(body: Record<string, unknown>): { sector: string; sectors: string[] } {
  const fromArray = Array.isArray(body.sectors)
    ? body.sectors.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const legacy = String(body.sector ?? '').trim();
  const fromLegacy = legacy
    ? legacy.split(',').map((value) => value.trim()).filter(Boolean)
    : [];
  const merged = (fromArray.length ? fromArray : fromLegacy)
    .filter((value) => ALLOWED.has(value) || value.length > 0)
    .slice(0, 12);
  const sectors = [...new Set(merged)];
  return {
    sectors,
    sector: sectors.join(', ').slice(0, 160),
  };
}

export function sectorChecklistOptions() {
  return SECTORS as readonly string[];
}
