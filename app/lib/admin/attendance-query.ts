import type { SupabaseClient } from '@supabase/supabase-js';
import {
  periodLabel,
  shiftPeriod,
  type AttendanceExportColumnId,
} from '@/app/lib/admin/attendance-columns';

export type AttendancePeriodFilter = 'morning' | 'afternoon';

export type AttendanceReportFilters = {
  fromDate?: string;
  toDate?: string;
  cohortId?: string;
  teamId?: string;
  status?: string;
  kind?: string;
  search?: string;
  blockId?: string;
  shiftId?: string;
  /** Multi-shift selection; when set, overrides single shiftId. */
  shiftIds?: string[];
  /** Volunteer registration sector (exact match). */
  sector?: string;
  /** Health sub-sector; only meaningful with sector=Health. */
  healthSubsector?: string;
  /** Morning / afternoon derived from shift start_time. Empty = all. */
  periods?: AttendancePeriodFilter[];
  /** Default true for official exports; false includes open/submitted (pending) sheets. */
  verifiedOnly?: boolean;
  scopedTeamIds?: string[] | null;
};

type ShiftRow = {
  id: string;
  name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  kind: string;
  team_id: string | null;
  sheet_status: string;
  location: string | null;
  cohort_id: string;
  block_id?: string | null;
  capacity?: number | null;
  ops_cohorts: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
  ops_teams: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
};

type RegistrationJoin = {
  id: string;
  registration_id?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  full_name_amharic?: string | null;
  sex?: string | null;
  age?: number | string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  email?: string | null;
  fan_number?: string | null;
  sector?: string | null;
  health_subsectors?: string[] | null;
  profession?: string | null;
  residence_region?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  cohort?: string | null;
  review_status?: string | null;
};

export type AttendanceFlatRow = {
  id: string;
  status: string;
  notes: string;
  checked_in_at: string | null;
  updated_at: string | null;
  shift_id: string;
  shift_name: string;
  shift_date: string;
  period: 'morning' | 'afternoon';
  period_label: string;
  start_time: string;
  end_time: string;
  shift_kind: string;
  sheet_status: string;
  location: string;
  team_name: string;
  cohort_code: string;
  cohort_name: string;
  block_id: string | null;
  capacity: number;
  registration: RegistrationJoin | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadAttendanceRows(
  supabase: SupabaseClient,
  filters: AttendanceReportFilters,
): Promise<AttendanceFlatRow[]> {
  let shiftsQuery = supabase
    .from('ops_shifts')
    .select('id, name, shift_date, start_time, end_time, kind, team_id, sheet_status, location, cohort_id, block_id, capacity, ops_cohorts(name, code), ops_teams(name, code)')
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (filters.verifiedOnly !== false) {
    shiftsQuery = shiftsQuery.eq('sheet_status', 'verified');
  }
  if (filters.fromDate) shiftsQuery = shiftsQuery.gte('shift_date', filters.fromDate);
  if (filters.toDate) shiftsQuery = shiftsQuery.lte('shift_date', filters.toDate);
  if (filters.cohortId) shiftsQuery = shiftsQuery.eq('cohort_id', filters.cohortId);
  if (filters.teamId) shiftsQuery = shiftsQuery.eq('team_id', filters.teamId);
  if (filters.kind) shiftsQuery = shiftsQuery.eq('kind', filters.kind);
  if (filters.blockId) shiftsQuery = shiftsQuery.eq('block_id', filters.blockId);
  const selectedShiftIds = (filters.shiftIds?.length
    ? filters.shiftIds
    : filters.shiftId
      ? [filters.shiftId]
      : []
  ).filter(Boolean);
  if (selectedShiftIds.length === 1) {
    shiftsQuery = shiftsQuery.eq('id', selectedShiftIds[0]);
  } else if (selectedShiftIds.length > 1) {
    shiftsQuery = shiftsQuery.in('id', selectedShiftIds);
  }

  if (filters.scopedTeamIds) {
    if (!filters.scopedTeamIds.length) return [];
    shiftsQuery = shiftsQuery.eq('kind', 'ops').in('team_id', filters.scopedTeamIds);
  }

  const { data: shiftsRaw, error: shiftsError } = await shiftsQuery;
  if (shiftsError) throw shiftsError;

  const periodSet = new Set(filters.periods ?? []);
  const shifts = ((shiftsRaw ?? []) as ShiftRow[]).filter((shift) => {
    if (!periodSet.size) return true;
    return periodSet.has(shiftPeriod(shift.start_time));
  });
  if (!shifts.length) return [];

  const shiftMap = new Map(shifts.map((shift) => [shift.id, shift]));
  const shiftIds = [...shiftMap.keys()];

  let marksQuery = supabase
    .from('ops_attendance')
    .select(`
      id,
      status,
      notes,
      checked_in_at,
      updated_at,
      shift_id,
      registration_id,
      registrations(
        id,
        registration_id,
        first_name,
        middle_name,
        last_name,
        full_name_amharic,
        sex,
        age,
        phone,
        secondary_phone,
        email,
        fan_number,
        sector,
        health_subsectors,
        profession,
        residence_region,
        bank_name,
        bank_account_name,
        bank_account_number,
        cohort,
        review_status
      )
    `)
    .in('shift_id', shiftIds)
    .order('updated_at', { ascending: false });

  if (filters.status) marksQuery = marksQuery.eq('status', filters.status);

  const { data: marks, error: marksError } = await marksQuery;
  if (marksError) throw marksError;

  const search = (filters.search || '').trim().toLowerCase();
  const rows: AttendanceFlatRow[] = [];

  for (const row of marks ?? []) {
    const shift = shiftMap.get(row.shift_id);
    if (!shift) continue;
    const person = one(row.registrations as RegistrationJoin | RegistrationJoin[] | null);
    if (person?.review_status && person.review_status !== 'approved') continue;

    if (filters.sector) {
      if (!person?.sector || person.sector !== filters.sector) continue;
    }
    if (filters.healthSubsector) {
      const subs = Array.isArray(person?.health_subsectors) ? person.health_subsectors : [];
      if (!subs.includes(filters.healthSubsector)) continue;
    }

    if (search) {
      if (!person) continue;
      const haystack = [
        person.first_name,
        person.middle_name,
        person.last_name,
        person.registration_id,
        person.email,
        person.phone,
        person.fan_number,
        person.sector,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!search.split(/\s+/).every((token) => haystack.includes(token))) continue;
    }

    const cohort = one(shift.ops_cohorts);
    const team = one(shift.ops_teams);
    const period = shiftPeriod(shift.start_time);
    rows.push({
      id: row.id,
      status: row.status,
      notes: row.notes || '',
      checked_in_at: row.checked_in_at,
      updated_at: row.updated_at,
      shift_id: shift.id,
      shift_name: shift.name,
      shift_date: shift.shift_date,
      period,
      period_label: periodLabel(period),
      start_time: String(shift.start_time).slice(0, 5),
      end_time: String(shift.end_time).slice(0, 5),
      shift_kind: shift.kind,
      sheet_status: shift.sheet_status,
      location: shift.location || '',
      team_name: team?.name || '',
      cohort_code: cohort?.code || '',
      cohort_name: cohort?.name || '',
      block_id: shift.block_id || null,
      capacity: Number(shift.capacity) || 0,
      registration: person,
    });
  }

  return rows;
}

/** @deprecated use loadAttendanceRows({ verifiedOnly: true }) */
export async function loadVerifiedAttendanceRows(
  supabase: SupabaseClient,
  filters: AttendanceReportFilters,
) {
  return loadAttendanceRows(supabase, { ...filters, verifiedOnly: true });
}

export function attendedCount(status: string) {
  return status === 'present' || status === 'late' ? 1 : 0;
}

/** Training rates: late counts as present/attended. Excused ignored for now → absent unless present/late. */
export function isAttendedStatus(status: string) {
  return status === 'present' || status === 'late';
}

type PersonDayKey = string;

/**
 * Training / bulk reporting: collapse morning+afternoon on the same date into one person-day.
 * Came either period → attended that day. Missed both → absent. Came both → still one day.
 */
export function summarizeTrainingByDay(rows: AttendanceFlatRow[]) {
  const personDays = new Map<
    PersonDayKey,
    {
      registrationId: string;
      publicId: string;
      name: string;
      sector: string;
      date: string;
      attended: boolean;
      morningStatus: string | null;
      afternoonStatus: string | null;
    }
  >();

  for (const row of rows) {
    const person = row.registration;
    if (!person?.id) continue;
    const sector = person.sector || 'Unassigned';
    const key = `${person.id}|${row.shift_date}`;
    const current = personDays.get(key) || {
      registrationId: person.id,
      publicId: person.registration_id || '',
      name: [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' '),
      sector,
      date: row.shift_date,
      attended: false,
      morningStatus: null,
      afternoonStatus: null,
    };
    if (isAttendedStatus(row.status)) current.attended = true;
    if (row.period === 'morning') current.morningStatus = row.status;
    if (row.period === 'afternoon') current.afternoonStatus = row.status;
    personDays.set(key, current);
  }

  const dayList = [...personDays.values()];

  const byPerson = new Map<
    string,
    {
      registrationId: string;
      publicId: string;
      name: string;
      sector: string;
      daysTotal: number;
      daysAttended: number;
      daysAbsent: number;
    }
  >();
  const bySector = new Map<
    string,
    {
      sector: string;
      people: Set<string>;
      daysTotal: number;
      daysAttended: number;
      daysAbsent: number;
    }
  >();
  const byDay = new Map<
    string,
    { date: string; people: number; attended: number; absent: number; shifts: Set<string> }
  >();

  for (const row of rows) {
    const day = byDay.get(row.shift_date) || {
      date: row.shift_date,
      people: 0,
      attended: 0,
      absent: 0,
      shifts: new Set<string>(),
    };
    day.shifts.add(row.shift_id);
    byDay.set(row.shift_date, day);
  }

  for (const entry of dayList) {
    const person = byPerson.get(entry.registrationId) || {
      registrationId: entry.registrationId,
      publicId: entry.publicId,
      name: entry.name,
      sector: entry.sector,
      daysTotal: 0,
      daysAttended: 0,
      daysAbsent: 0,
    };
    person.daysTotal += 1;
    if (entry.attended) person.daysAttended += 1;
    else person.daysAbsent += 1;
    byPerson.set(entry.registrationId, person);

    const sector = bySector.get(entry.sector) || {
      sector: entry.sector,
      people: new Set<string>(),
      daysTotal: 0,
      daysAttended: 0,
      daysAbsent: 0,
    };
    sector.people.add(entry.registrationId);
    sector.daysTotal += 1;
    if (entry.attended) sector.daysAttended += 1;
    else sector.daysAbsent += 1;
    bySector.set(entry.sector, sector);

    const day = byDay.get(entry.date);
    if (day) {
      day.people += 1;
      if (entry.attended) day.attended += 1;
      else day.absent += 1;
    }
  }

  const totals = {
    people: byPerson.size,
    daysTotal: dayList.length,
    daysAttended: dayList.filter((entry) => entry.attended).length,
    daysAbsent: dayList.filter((entry) => !entry.attended).length,
  };
  const participationRate = totals.daysTotal ? totals.daysAttended / totals.daysTotal : 0;

  return {
    mode: 'day' as const,
    rule: 'late_counts_as_present; morning_or_afternoon_counts_as_one_day',
    totals: {
      ...totals,
      participationPercent: Math.round(participationRate * 1000) / 10,
    },
    byPerson: [...byPerson.values()]
      .map((person) => ({
        ...person,
        participationPercent: person.daysTotal
          ? Math.round((person.daysAttended / person.daysTotal) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.sector.localeCompare(b.sector)),
    bySector: [...bySector.values()]
      .map(({ people, ...sector }) => ({
        ...sector,
        peopleCount: people.size,
        participationPercent: sector.daysTotal
          ? Math.round((sector.daysAttended / sector.daysTotal) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.daysAttended - a.daysAttended || a.sector.localeCompare(b.sector)),
    byDay: [...byDay.values()]
      .map(({ shifts, ...day }) => ({
        ...day,
        shifts: shifts.size,
        participationPercent: day.people ? Math.round((day.attended / day.people) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    personDays: dayList
      .map((entry) => ({
        ...entry,
        status: entry.attended ? 'attended' : 'absent',
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)),
  };
}

export function summarizeAttendance(rows: AttendanceFlatRow[]) {
  const byShift = new Map<
    string,
    {
      shiftId: string;
      shiftName: string;
      shiftDate: string;
      period: string;
      kind: string;
      teamName: string;
      cohortCode: string;
      sheetStatus: string;
      capacity: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
      total: number;
      attended: number;
    }
  >();
  const byPerson = new Map<
    string,
    {
      registrationId: string;
      publicId: string;
      name: string;
      sector: string;
      present: number;
      late: number;
      absent: number;
      excused: number;
      total: number;
      attended: number;
    }
  >();
  const bySector = new Map<
    string,
    {
      sector: string;
      present: number;
      late: number;
      absent: number;
      excused: number;
      total: number;
      attended: number;
      people: Set<string>;
    }
  >();
  const byDay = new Map<
    string,
    { date: string; present: number; late: number; absent: number; excused: number; total: number; attended: number; shifts: number }
  >();
  const byPeriod = new Map<
    string,
    { period: string; present: number; late: number; absent: number; excused: number; total: number; attended: number }
  >();

  for (const row of rows) {
    const shiftSummary = byShift.get(row.shift_id) || {
      shiftId: row.shift_id,
      shiftName: row.shift_name,
      shiftDate: row.shift_date,
      period: row.period_label,
      kind: row.shift_kind,
      teamName: row.team_name,
      cohortCode: row.cohort_code,
      sheetStatus: row.sheet_status,
      capacity: row.capacity,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      total: 0,
      attended: 0,
    };
    shiftSummary.total += 1;
    shiftSummary.attended += attendedCount(row.status);
    if (row.status === 'present' || row.status === 'late' || row.status === 'absent' || row.status === 'excused') {
      shiftSummary[row.status] += 1;
    }
    byShift.set(row.shift_id, shiftSummary);

    const day = byDay.get(row.shift_date) || {
      date: row.shift_date,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      total: 0,
      attended: 0,
      shifts: 0,
    };
    // count unique shifts later; for now accumulate marks
    day.total += 1;
    day.attended += attendedCount(row.status);
    if (row.status === 'present' || row.status === 'late' || row.status === 'absent' || row.status === 'excused') {
      day[row.status] += 1;
    }
    byDay.set(row.shift_date, day);

    const periodKey = row.period_label;
    const periodSummary = byPeriod.get(periodKey) || {
      period: periodKey,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      total: 0,
      attended: 0,
    };
    periodSummary.total += 1;
    periodSummary.attended += attendedCount(row.status);
    if (row.status === 'present' || row.status === 'late' || row.status === 'absent' || row.status === 'excused') {
      periodSummary[row.status] += 1;
    }
    byPeriod.set(periodKey, periodSummary);

    const person = row.registration;
    if (!person?.id) continue;
    const sectorName = person.sector || 'Unassigned';
    const personSummary = byPerson.get(person.id) || {
      registrationId: person.id,
      publicId: person.registration_id || '',
      name: [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' '),
      sector: sectorName,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      total: 0,
      attended: 0,
    };
    personSummary.total += 1;
    personSummary.attended += attendedCount(row.status);
    if (row.status === 'present' || row.status === 'late' || row.status === 'absent' || row.status === 'excused') {
      personSummary[row.status] += 1;
    }
    byPerson.set(person.id, personSummary);

    const sectorSummary = bySector.get(sectorName) || {
      sector: sectorName,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      total: 0,
      attended: 0,
      people: new Set<string>(),
    };
    sectorSummary.total += 1;
    sectorSummary.attended += attendedCount(row.status);
    sectorSummary.people.add(person.id);
    if (row.status === 'present' || row.status === 'late' || row.status === 'absent' || row.status === 'excused') {
      sectorSummary[row.status] += 1;
    }
    bySector.set(sectorName, sectorSummary);
  }

  // Fix day.shifts = number of distinct shifts that day
  const shiftsPerDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = shiftsPerDay.get(row.shift_date) || new Set<string>();
    set.add(row.shift_id);
    shiftsPerDay.set(row.shift_date, set);
  }
  for (const [date, day] of byDay) {
    day.shifts = shiftsPerDay.get(date)?.size ?? 0;
  }

  const dayList = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const dayRates = dayList.map((day) => (day.total ? day.attended / day.total : 0));
  const avgParticipationRate = dayRates.length
    ? dayRates.reduce((sum, rate) => sum + rate, 0) / dayRates.length
    : 0;
  const avgAttendedPerDay = dayList.length
    ? dayList.reduce((sum, day) => sum + day.attended, 0) / dayList.length
    : 0;
  const avgRosterPerDay = dayList.length
    ? dayList.reduce((sum, day) => sum + day.total, 0) / dayList.length
    : 0;

  return {
    totals: {
      total: rows.length,
      present: rows.filter((row) => row.status === 'present').length,
      late: rows.filter((row) => row.status === 'late').length,
      absent: rows.filter((row) => row.status === 'absent').length,
      excused: rows.filter((row) => row.status === 'excused').length,
      attended: rows.filter((row) => attendedCount(row.status)).length,
    },
    averages: {
      avgParticipationRate,
      avgParticipationPercent: Math.round(avgParticipationRate * 1000) / 10,
      avgAttendedPerDay: Math.round(avgAttendedPerDay * 10) / 10,
      avgRosterPerDay: Math.round(avgRosterPerDay * 10) / 10,
      dayCount: dayList.length,
    },
    byDay: dayList.map((day) => ({
      ...day,
      participationPercent: day.total ? Math.round((day.attended / day.total) * 1000) / 10 : 0,
    })),
    byShift: [...byShift.values()]
      .map((shift) => ({
        ...shift,
        participationPercent: shift.total ? Math.round((shift.attended / shift.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => `${a.shiftDate}${a.shiftName}`.localeCompare(`${b.shiftDate}${b.shiftName}`)),
    byPerson: [...byPerson.values()]
      .map((person) => ({
        ...person,
        participationPercent: person.total ? Math.round((person.attended / person.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.sector.localeCompare(b.sector)),
    bySector: [...bySector.values()]
      .map(({ people, ...sector }) => ({
        ...sector,
        peopleCount: people.size,
        participationPercent: sector.total ? Math.round((sector.attended / sector.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.attended - a.attended || a.sector.localeCompare(b.sector)),
    byPeriod: [...byPeriod.values()]
      .map((period) => ({
        ...period,
        participationPercent: period.total ? Math.round((period.attended / period.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    exceptions: rows.filter((row) => row.status === 'absent' || row.status === 'late'),
  };
}

export function parseAttendancePeriods(raw: string | null | undefined): AttendancePeriodFilter[] | undefined {
  if (!raw?.trim()) return undefined;
  const values = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is AttendancePeriodFilter => item === 'morning' || item === 'afternoon');
  return values.length ? [...new Set(values)] : undefined;
}

export function cellForAttendanceExport(
  row: AttendanceFlatRow,
  column: AttendanceExportColumnId,
): string {
  const person = row.registration;
  switch (column) {
    case 'status':
      return row.status;
    case 'notes':
      return row.notes;
    case 'checked_in_at':
      return row.checked_in_at || '';
    case 'updated_at':
      return row.updated_at || '';
    case 'shift_name':
      return row.shift_name;
    case 'shift_date':
      return row.shift_date;
    case 'period':
      return row.period_label;
    case 'start_time':
      return row.start_time;
    case 'end_time':
      return row.end_time;
    case 'shift_kind':
      return row.shift_kind;
    case 'sheet_status':
      return row.sheet_status;
    case 'location':
      return row.location;
    case 'team_name':
      return row.team_name;
    case 'cohort_code':
      return row.cohort_code;
    case 'cohort_name':
      return row.cohort_name;
    case 'health_subsectors':
      return Array.isArray(person?.health_subsectors) ? person.health_subsectors.join('; ') : '';
    default: {
      const value = person?.[column as keyof RegistrationJoin];
      if (Array.isArray(value)) return value.join('; ');
      if (value == null) return '';
      return String(value);
    }
  }
}
