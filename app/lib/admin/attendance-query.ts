import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSector } from '@cphia/shared/constants';
import {
  ATTENDANCE_PERSON_COLUMNS,
  attendanceDayColumnHeader,
  attendancePeriodColumnHeader,
  periodLabel,
  sheetStatusLabel,
  shiftPeriod,
  type AttendanceExportColumnId,
  type AttendancePersonColumnId,
} from '@/app/lib/admin/attendance-columns';
import {
  fetchAllPaged,
  sectorFilterValues,
  subsectorStorageColumn,
} from '@/app/lib/admin/registration-filters';

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
  role_subsectors?: string[] | null;
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
        role_subsectors,
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
    // Official attendance counts approved volunteers only.
    if (!person || person.review_status !== 'approved') continue;

    if (filters.sector) {
      const wanted = normalizeSector(filters.sector) || filters.sector;
      const actual = normalizeSector(person?.sector) || person?.sector || '';
      if (!actual || actual !== wanted) continue;
    }
    if (filters.healthSubsector) {
      const column = subsectorStorageColumn(filters.healthSubsector);
      const subs = Array.isArray(person?.[column]) ? person[column] : [];
      if (!subs?.includes(filters.healthSubsector)) continue;
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

export type ApprovedVolunteerSeed = {
  id: string;
  registration_id: string;
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
  role_subsectors?: string[] | null;
  profession?: string | null;
  residence_region?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  cohort?: string | null;
};

function personDisplayName(person: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
}

/**
 * Approved volunteer universe for training reports / came-vs-never denominators.
 * Optional sector, health sub-sector, and person search match attendance filters.
 */
export async function loadApprovedVolunteers(
  supabase: SupabaseClient,
  filters: Pick<AttendanceReportFilters, 'sector' | 'healthSubsector' | 'search'>,
): Promise<ApprovedVolunteerSeed[]> {
  const sector = normalizeSector(filters.sector) || filters.sector || '';
  const { rows: data } = await fetchAllPaged<ApprovedVolunteerSeed>(() => {
    let query = supabase
      .from('registrations')
      .select(
        'id, registration_id, first_name, middle_name, last_name, full_name_amharic, sex, age, phone, secondary_phone, email, fan_number, sector, health_subsectors, role_subsectors, profession, residence_region, bank_name, bank_account_name, bank_account_number, cohort',
        { count: 'exact' },
      )
      .eq('review_status', 'approved')
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true });

    // Sector is exact. Sub-category is applied separately via health/role_subsectors.
    if (sector) {
      const variants = sectorFilterValues(sector);
      if (variants.length === 1) query = query.eq('sector', variants[0]);
      else query = query.in('sector', variants);
    }
    if (filters.healthSubsector) {
      query = query.contains(subsectorStorageColumn(filters.healthSubsector), [filters.healthSubsector]);
    }
    return query as never;
  });

  const search = (filters.search || '').trim().toLowerCase();
  let rows = data;
  // Canonicalize sector labels so report grouping / client filters stay consistent.
  rows = rows.map((person) => ({
    ...person,
    sector: normalizeSector(person.sector) || person.sector || 'Unassigned',
  }));
  if (!search) return rows;

  const tokens = search.split(/\s+/).filter(Boolean);
  return rows.filter((person) => {
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
    return tokens.every((token) => haystack.includes(token));
  });
}

export function attendedCount(status: string) {
  return status === 'present' || status === 'late' ? 1 : 0;
}

/** Training rates: late counts as present/attended. Excused ignored for now → absent unless present/late. */
export function isAttendedStatus(status: string) {
  return status === 'present' || status === 'late';
}

type PersonDayKey = string;

type PersonSummaryAcc = {
  registrationId: string;
  publicId: string;
  name: string;
  sector: string;
  daysTotal: number;
  daysAttended: number;
  daysAbsent: number;
  attendedDates: Set<string>;
  absentDates: Set<string>;
  shiftsTotal: number;
  shiftsAttended: number;
  morningShifts: number;
  afternoonShifts: number;
  morningAttended: number;
  afternoonAttended: number;
};

function emptyPersonSummary(seed: {
  registrationId: string;
  publicId: string;
  name: string;
  sector: string;
}): PersonSummaryAcc {
  return {
    registrationId: seed.registrationId,
    publicId: seed.publicId,
    name: seed.name,
    sector: seed.sector,
    daysTotal: 0,
    daysAttended: 0,
    daysAbsent: 0,
    attendedDates: new Set<string>(),
    absentDates: new Set<string>(),
    shiftsTotal: 0,
    shiftsAttended: 0,
    morningShifts: 0,
    afternoonShifts: 0,
    morningAttended: 0,
    afternoonAttended: 0,
  };
}

function emptySectorSummary(sector: string) {
  return {
    sector,
    people: new Set<string>(),
    peopleCame: new Set<string>(),
    peopleNever: new Set<string>(),
    daysTotal: 0,
    daysAttended: 0,
    daysAbsent: 0,
    shiftsTotal: 0,
    shiftsAttended: 0,
  };
}

/**
 * Training / bulk reporting: collapse morning+afternoon on the same date into one person-day.
 * Came either period → attended that day. Missed both → absent. Came both → still one day.
 * Also tracks raw shift (sheet) attendance so reports can show days + shifts together.
 *
 * When `approvedPeople` is provided, sector People / Came / Never use the approved pool
 * (including approved volunteers who never appeared on a selected sheet).
 */
export function summarizeTrainingByDay(
  rows: AttendanceFlatRow[],
  options?: { approvedPeople?: ApprovedVolunteerSeed[] },
) {
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

  const byPerson = new Map<string, PersonSummaryAcc>();
  const bySector = new Map<string, ReturnType<typeof emptySectorSummary>>();
  const byDay = new Map<
    string,
    { date: string; people: number; attended: number; absent: number; shifts: Set<string> }
  >();

  for (const row of rows) {
    const person = row.registration;
    if (!person?.id) continue;
    const sectorName = normalizeSector(person.sector) || person.sector || 'Unassigned';
    const key = `${person.id}|${row.shift_date}`;
    const current = personDays.get(key) || {
      registrationId: person.id,
      publicId: person.registration_id || '',
      name: personDisplayName(person),
      sector: sectorName,
      date: row.shift_date,
      attended: false,
      morningStatus: null,
      afternoonStatus: null,
    };
    if (isAttendedStatus(row.status)) current.attended = true;
    if (row.period === 'morning') current.morningStatus = row.status;
    if (row.period === 'afternoon') current.afternoonStatus = row.status;
    personDays.set(key, current);

    const personSummary = byPerson.get(person.id) || emptyPersonSummary({
      registrationId: person.id,
      publicId: person.registration_id || '',
      name: personDisplayName(person),
      sector: sectorName,
    });
    personSummary.shiftsTotal += 1;
    if (isAttendedStatus(row.status)) personSummary.shiftsAttended += 1;
    if (row.period === 'morning') {
      personSummary.morningShifts += 1;
      if (isAttendedStatus(row.status)) personSummary.morningAttended += 1;
    }
    if (row.period === 'afternoon') {
      personSummary.afternoonShifts += 1;
      if (isAttendedStatus(row.status)) personSummary.afternoonAttended += 1;
    }
    byPerson.set(person.id, personSummary);

    const sectorSummary = bySector.get(sectorName) || emptySectorSummary(sectorName);
    sectorSummary.people.add(person.id);
    sectorSummary.shiftsTotal += 1;
    if (isAttendedStatus(row.status)) sectorSummary.shiftsAttended += 1;
    bySector.set(sectorName, sectorSummary);

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

  const dayList = [...personDays.values()];

  for (const entry of dayList) {
    const person = byPerson.get(entry.registrationId);
    if (!person) continue;
    person.daysTotal += 1;
    if (entry.attended) {
      person.daysAttended += 1;
      person.attendedDates.add(entry.date);
    } else {
      person.daysAbsent += 1;
      person.absentDates.add(entry.date);
    }

    const sector = bySector.get(entry.sector);
    if (sector) {
      sector.daysTotal += 1;
      if (entry.attended) sector.daysAttended += 1;
      else sector.daysAbsent += 1;
    }

    const day = byDay.get(entry.date);
    if (day) {
      day.people += 1;
      if (entry.attended) day.attended += 1;
      else day.absent += 1;
    }
  }

  for (const approved of options?.approvedPeople ?? []) {
    const sectorName = normalizeSector(approved.sector) || approved.sector || 'Unassigned';
    if (!byPerson.has(approved.id)) {
      byPerson.set(
        approved.id,
        emptyPersonSummary({
          registrationId: approved.id,
          publicId: approved.registration_id || '',
          name: personDisplayName(approved),
          sector: sectorName,
        }),
      );
    } else {
      // Prefer canonical sector label when the mark join had an older spelling.
      const existing = byPerson.get(approved.id)!;
      existing.sector = sectorName;
    }
    const sectorSummary = bySector.get(sectorName) || emptySectorSummary(sectorName);
    sectorSummary.people.add(approved.id);
    bySector.set(sectorName, sectorSummary);
  }

  for (const sector of bySector.values()) {
    sector.peopleCame.clear();
    sector.peopleNever.clear();
  }
  for (const person of byPerson.values()) {
    const sector = bySector.get(person.sector);
    if (!sector) continue;
    sector.people.add(person.registrationId);
    if (person.daysAttended > 0) sector.peopleCame.add(person.registrationId);
    else sector.peopleNever.add(person.registrationId);
  }

  const peopleCame = [...byPerson.values()].filter((person) => person.daysAttended > 0).length;
  const peopleNever = byPerson.size - peopleCame;
  const totals = {
    people: byPerson.size,
    peopleCame,
    peopleNever,
    daysTotal: dayList.length,
    daysAttended: dayList.filter((entry) => entry.attended).length,
    daysAbsent: dayList.filter((entry) => !entry.attended).length,
    shiftsTotal: rows.length,
    shiftsAttended: rows.filter((row) => isAttendedStatus(row.status)).length,
  };
  const participationRate = totals.daysTotal ? totals.daysAttended / totals.daysTotal : 0;

  return {
    mode: 'day' as const,
    rule: 'approved_only; late_counts_as_present; morning_or_afternoon_counts_as_one_day',
    totals: {
      ...totals,
      participationPercent: Math.round(participationRate * 1000) / 10,
      shiftParticipationPercent: totals.shiftsTotal
        ? Math.round((totals.shiftsAttended / totals.shiftsTotal) * 1000) / 10
        : 0,
    },
    byPerson: [...byPerson.values()]
      .map(({ attendedDates, absentDates, ...person }) => ({
        ...person,
        came: person.daysAttended > 0,
        attendedDates: [...attendedDates].sort(),
        absentDates: [...absentDates].sort(),
        participationPercent: person.daysTotal
          ? Math.round((person.daysAttended / person.daysTotal) * 1000) / 10
          : 0,
        shiftParticipationPercent: person.shiftsTotal
          ? Math.round((person.shiftsAttended / person.shiftsTotal) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.sector.localeCompare(b.sector)),
    bySector: [...bySector.values()]
      .map(({ people, peopleCame: cameSet, peopleNever: neverSet, ...sector }) => ({
        ...sector,
        peopleCount: people.size,
        peopleCame: cameSet.size,
        peopleNever: neverSet.size,
        participationPercent: sector.daysTotal
          ? Math.round((sector.daysAttended / sector.daysTotal) * 1000) / 10
          : 0,
        shiftParticipationPercent: sector.shiftsTotal
          ? Math.round((sector.shiftsAttended / sector.shiftsTotal) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.peopleCame - a.peopleCame || a.sector.localeCompare(b.sector)),
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

export type PersonDayExportMode = 'day' | 'period';

function personCellValue(
  person: ApprovedVolunteerSeed | RegistrationJoin,
  column: AttendancePersonColumnId,
): string {
  if (column === 'health_subsectors' || column === 'role_subsectors') {
    const value = person[column];
    return Array.isArray(value) ? value.join('; ') : '';
  }
  const value = person[column as keyof typeof person];
  if (Array.isArray(value)) return value.join('; ');
  if (value == null) return '';
  return String(value);
}

/**
 * One row per approved volunteer; date (or morning/afternoon) columns in the header.
 * Day mode cell: Came / Missed / Not on sheet
 * Period mode cell: Present / Late / Absent / Excused / Not on sheet
 */
export function buildPersonAttendanceExport(options: {
  rows: AttendanceFlatRow[];
  approvedPeople: ApprovedVolunteerSeed[];
  personColumns: AttendancePersonColumnId[];
  mode?: PersonDayExportMode;
}): { headers: string[]; records: string[][] } {
  const mode = options.mode ?? 'day';
  const dates = [...new Set(options.rows.map((row) => row.shift_date))].sort();
  const periodKeys = ['morning', 'afternoon'] as const;

  type DayAcc = {
    attended: boolean;
    onSheet: boolean;
    morning?: string;
    afternoon?: string;
  };
  const byPersonDay = new Map<string, DayAcc>();
  const peopleFromMarks = new Map<string, ApprovedVolunteerSeed>();

  for (const row of options.rows) {
    const person = row.registration;
    if (!person?.id) continue;
    peopleFromMarks.set(person.id, {
      id: person.id,
      registration_id: person.registration_id || '',
      first_name: person.first_name,
      middle_name: person.middle_name,
      last_name: person.last_name,
      full_name_amharic: person.full_name_amharic,
      sex: person.sex,
      age: person.age,
      phone: person.phone,
      secondary_phone: person.secondary_phone,
      email: person.email,
      fan_number: person.fan_number,
      sector: person.sector,
      health_subsectors: person.health_subsectors,
      role_subsectors: person.role_subsectors,
      profession: person.profession,
      residence_region: person.residence_region,
      bank_name: person.bank_name,
      bank_account_name: person.bank_account_name,
      bank_account_number: person.bank_account_number,
      cohort: person.cohort,
    });
    const key = `${person.id}|${row.shift_date}`;
    const current = byPersonDay.get(key) || { attended: false, onSheet: false };
    current.onSheet = true;
    if (isAttendedStatus(row.status)) current.attended = true;
    if (row.period === 'morning') current.morning = row.status;
    if (row.period === 'afternoon') current.afternoon = row.status;
    byPersonDay.set(key, current);
  }

  const peopleMap = new Map<string, ApprovedVolunteerSeed>();
  for (const person of options.approvedPeople) peopleMap.set(person.id, person);
  for (const [id, person] of peopleFromMarks) {
    if (!peopleMap.has(id)) peopleMap.set(id, person);
  }
  const people = [...peopleMap.values()].sort((a, b) => {
    const nameA = personDisplayName(a);
    const nameB = personDisplayName(b);
    return nameA.localeCompare(nameB) || (a.sector || '').localeCompare(b.sector || '');
  });

  const dateHeaders =
    mode === 'period'
      ? dates.flatMap((date) =>
          periodKeys.map((period) => attendancePeriodColumnHeader(date, period)),
        )
      : dates.map((date) => attendanceDayColumnHeader(date));

  const summaryHeaders =
    mode === 'day'
      ? [
          'Came at least once (Yes/No)',
          'Training days attended',
          'Training days missed (on sheet)',
          'Shift sheets attended',
          'Shift sheets on roster',
        ]
      : [
          'Came at least once (Yes/No)',
          'Morning sheets attended',
          'Afternoon sheets attended',
          'Shift sheets attended',
          'Shift sheets on roster',
        ];

  const personLabels = new Map(ATTENDANCE_PERSON_COLUMNS.map((column) => [column.id, column.label]));
  const headers = [
    ...options.personColumns.map((column) => personLabels.get(column) || column),
    ...dateHeaders,
    ...summaryHeaders,
  ];

  const records = people.map((person) => {
    const identity = options.personColumns.map((column) => personCellValue(person, column));
    let daysAttended = 0;
    let daysMissed = 0;
    let morningAttended = 0;
    let afternoonAttended = 0;
    let shiftsAttended = 0;
    let shiftsTotal = 0;
    let came = false;

    const dayCells: string[] = [];
    for (const date of dates) {
      const entry = byPersonDay.get(`${person.id}|${date}`);
      if (mode === 'day') {
        if (!entry?.onSheet) {
          dayCells.push('Not on sheet');
        } else if (entry.attended) {
          dayCells.push('Came');
          daysAttended += 1;
          came = true;
        } else {
          dayCells.push('Missed');
          daysMissed += 1;
        }
      } else {
        for (const period of periodKeys) {
          const status = period === 'morning' ? entry?.morning : entry?.afternoon;
          if (!status) {
            dayCells.push('Not on sheet');
            continue;
          }
          shiftsTotal += 1;
          const label =
            status === 'present'
              ? 'Present'
              : status === 'late'
                ? 'Late (counts as present)'
                : status === 'excused'
                  ? 'Excused'
                  : status === 'absent'
                    ? 'Absent'
                    : status;
          dayCells.push(label);
          if (isAttendedStatus(status)) {
            shiftsAttended += 1;
            came = true;
            if (period === 'morning') morningAttended += 1;
            else afternoonAttended += 1;
          }
        }
      }
    }

    if (mode === 'day') {
      for (const date of dates) {
        const entry = byPersonDay.get(`${person.id}|${date}`);
        if (!entry?.onSheet) continue;
        for (const status of [entry.morning, entry.afternoon]) {
          if (!status) continue;
          shiftsTotal += 1;
          if (isAttendedStatus(status)) shiftsAttended += 1;
        }
      }
    }

    const summary =
      mode === 'day'
        ? [
            came ? 'Yes' : 'No',
            String(daysAttended),
            String(daysMissed),
            String(shiftsAttended),
            String(shiftsTotal),
          ]
        : [
            came ? 'Yes' : 'No',
            String(morningAttended),
            String(afternoonAttended),
            String(shiftsAttended),
            String(shiftsTotal),
          ];

    return [...identity, ...dayCells, ...summary];
  });

  return { headers, records };
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
      return sheetStatusLabel(row.sheet_status);
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
    case 'role_subsectors':
      return Array.isArray(person?.role_subsectors) ? person.role_subsectors.join('; ') : '';
    default: {
      const value = person?.[column as keyof RegistrationJoin];
      if (Array.isArray(value)) return value.join('; ');
      if (value == null) return '';
      return String(value);
    }
  }
}
