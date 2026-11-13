import { SECTORS, sectorsMatch } from '@cphia/shared/constants';

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

/** Resolve checklist + legacy comma string into a clean sector list. */
export function listedShiftSectors(input: {
  sector?: string | null;
  sectors?: string[] | null;
}): string[] {
  if (Array.isArray(input.sectors) && input.sectors.length) {
    return [...new Set(input.sectors.map((item) => String(item).trim()).filter(Boolean))];
  }
  const legacy = String(input.sector || '').trim();
  if (!legacy) return [];
  return [...new Set(legacy.split(',').map((item) => item.trim()).filter(Boolean))];
}

/**
 * Whether a shift applies to a volunteer sector.
 * Empty checklist = open to every sector (shared floor / mixed bulk).
 */
export function shiftAppliesToSector(
  shift: { sector?: string | null; sectors?: string[] | null },
  volunteerSector: string | null | undefined,
): boolean {
  const listed = listedShiftSectors(shift);
  if (!listed.length) return true;
  const wanted = String(volunteerSector || '').trim();
  if (!wanted) return true;
  return listed.some((sector) => sectorsMatch(sector, wanted));
}
