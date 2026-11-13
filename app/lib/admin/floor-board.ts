import { listedShiftSectors, shiftAppliesToSector } from '@/app/lib/admin/shift-sectors';

export type FloorPhase = 'live' | 'upcoming' | 'ended';

export type FloorMark = {
  status?: string | null;
  registration_id?: string | null;
};

export function localDateParam(value?: string | null) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toLocaleDateString('en-CA');
}

export function localTimeParam(value?: string | null) {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function minutesOf(hhmm: string) {
  const [hours, minutes] = hhmm.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

/** Live when current local time is inside [start, end). Overnight windows are not used. */
export function shiftPhase(startTime: string, endTime: string, nowHHMM: string): FloorPhase {
  const start = minutesOf(String(startTime || '00:00'));
  const end = minutesOf(String(endTime || '00:00'));
  const now = minutesOf(nowHHMM);
  if (now >= start && now < end) return 'live';
  if (now < start) return 'upcoming';
  return 'ended';
}

export function summarizeMarks(marks: FloorMark[]) {
  const present = marks.filter((mark) => mark.status === 'present').length;
  const late = marks.filter((mark) => mark.status === 'late').length;
  const absent = marks.filter((mark) => mark.status === 'absent').length;
  const excused = marks.filter((mark) => mark.status === 'excused').length;
  const checkedIn = present + late;
  return { present, late, absent, excused, checkedIn, totalMarked: marks.length };
}

/** Unique people with present/late across the day (morning + afternoon = one person). */
export function uniqueCheckedInPeople(marks: FloorMark[]) {
  const ids = new Set<string>();
  for (const mark of marks) {
    if (!mark.registration_id) continue;
    if (mark.status === 'present' || mark.status === 'late') ids.add(mark.registration_id);
  }
  return ids.size;
}

export function capacityGap(capacity: number, checkedIn: number) {
  if (!capacity || capacity <= 0) return 0;
  return Math.max(0, capacity - checkedIn);
}

export function shiftMatchesSectorFilter(
  shift: { sector?: string | null; sectors?: string[] | null },
  sector: string | null | undefined,
) {
  if (!sector) return true;
  return shiftAppliesToSector(shift, sector);
}

export function shiftSectorLabel(shift: { sector?: string | null; sectors?: string[] | null }) {
  const listed = listedShiftSectors(shift);
  if (!listed.length) return 'All sectors';
  return listed.join(', ');
}

export function sortFloorShifts<T extends { phase: FloorPhase; start: string; name: string }>(rows: T[]) {
  const rank: Record<FloorPhase, number> = { live: 0, upcoming: 1, ended: 2 };
  return [...rows].sort((a, b) => {
    const byPhase = rank[a.phase] - rank[b.phase];
    if (byPhase) return byPhase;
    return a.start.localeCompare(b.start) || a.name.localeCompare(b.name);
  });
}
