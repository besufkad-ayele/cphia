/** Columns for attendance reports / export (approved volunteers only). */

export const ATTENDANCE_MARK_COLUMNS = [
  { id: 'status', label: 'Attendance mark (present / late / absent / excused)' },
  { id: 'notes', label: 'Attendance notes from checker' },
  { id: 'checked_in_at', label: 'Check-in timestamp' },
  { id: 'updated_at', label: 'Attendance mark last updated' },
  { id: 'shift_name', label: 'Shift / sheet name' },
  { id: 'shift_date', label: 'Shift calendar date' },
  { id: 'period', label: 'Session period (Morning or Afternoon)' },
  { id: 'start_time', label: 'Shift start time' },
  { id: 'end_time', label: 'Shift end time' },
  { id: 'shift_kind', label: 'Shift kind (training / ops)' },
  { id: 'sheet_status', label: 'Sheet workflow status (pending / submitted / completed)' },
  { id: 'location', label: 'Shift location' },
  { id: 'team_name', label: 'Floor team name' },
  { id: 'cohort_code', label: 'Event / cohort code' },
  { id: 'cohort_name', label: 'Event / cohort name' },
] as const;

/** Registration fields commonly needed beside attendance marks. */
export const ATTENDANCE_PERSON_COLUMNS = [
  { id: 'registration_id', label: 'Volunteer registration ID' },
  { id: 'first_name', label: 'Given name' },
  { id: 'middle_name', label: 'Father name' },
  { id: 'last_name', label: 'Grandfather name' },
  { id: 'full_name_amharic', label: 'Full name (Amharic)' },
  { id: 'sex', label: 'Gender' },
  { id: 'age', label: 'Age (years)' },
  { id: 'phone', label: 'Primary phone' },
  { id: 'secondary_phone', label: 'Secondary phone' },
  { id: 'email', label: 'Email address' },
  { id: 'fan_number', label: 'FAN number' },
  { id: 'sector', label: 'Assigned sector' },
  { id: 'health_subsectors', label: 'Health sub-category' },
  { id: 'role_subsectors', label: 'Sub-category' },
  { id: 'profession', label: 'Profession' },
  { id: 'residence_region', label: 'Residence region' },
  { id: 'bank_name', label: 'Bank name' },
  { id: 'bank_account_name', label: 'Bank account owner name' },
  { id: 'bank_account_number', label: 'Bank account number' },
  { id: 'cohort', label: 'Volunteer cohort code' },
] as const;

export type AttendancePersonColumnId = (typeof ATTENDANCE_PERSON_COLUMNS)[number]['id'];

/** Person identity columns used for one-row-per-volunteer bulk exports. */
export const ATTENDANCE_PERSON_EXPORT_COLUMN_IDS: AttendancePersonColumnId[] =
  ATTENDANCE_PERSON_COLUMNS.map((column) => column.id);

export const ATTENDANCE_EXPORT_COLUMNS = [
  ...ATTENDANCE_PERSON_COLUMNS,
  ...ATTENDANCE_MARK_COLUMNS,
] as const;

export type AttendanceExportColumnId = (typeof ATTENDANCE_EXPORT_COLUMNS)[number]['id'];

export const DEFAULT_ATTENDANCE_EXPORT_COLUMNS: AttendanceExportColumnId[] = [
  'registration_id',
  'first_name',
  'middle_name',
  'last_name',
  'phone',
  'email',
  'sector',
  'health_subsectors',
  'role_subsectors',
  'bank_account_name',
  'bank_account_number',
  'status',
  'shift_name',
  'shift_date',
  'period',
  'checked_in_at',
  'notes',
];

/** Default identity columns when exporting bulk training as one row per approved volunteer. */
export const DEFAULT_PERSON_DAY_EXPORT_COLUMNS: AttendancePersonColumnId[] = [
  'registration_id',
  'first_name',
  'middle_name',
  'last_name',
  'phone',
  'email',
  'sector',
  'health_subsectors',
  'role_subsectors',
  'age',
  'bank_account_name',
  'bank_account_number',
];

export function shiftPeriod(startTime: string | null | undefined): 'morning' | 'afternoon' {
  const hour = Number(String(startTime ?? '00').slice(0, 2));
  if (!Number.isFinite(hour)) return 'morning';
  return hour < 13 ? 'morning' : 'afternoon';
}

export function periodLabel(period: 'morning' | 'afternoon') {
  return period === 'morning' ? 'Morning' : 'Afternoon';
}

/** Sheet workflow labels for reports UI / export. */
export function sheetStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'open':
      return 'Pending';
    case 'submitted':
      return 'Submitted';
    case 'verified':
      return 'Completed';
    default:
      return status || 'Unknown';
  }
}

/**
 * Training export day header: "Monday 09" (weekday + day-of-month).
 * Uses Africa/Addis noon anchor so the calendar day does not drift.
 */
export function attendanceDayColumnHeader(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(`${isoDate}T12:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Africa/Addis_Ababa',
  }).format(date);
  return `${weekday} ${match[3]}`;
}

export function attendancePeriodColumnHeader(isoDate: string, period: 'morning' | 'afternoon') {
  return `${attendanceDayColumnHeader(isoDate)} · ${periodLabel(period)}`;
}

export const PERIOD_PRESETS = {
  morning: { startTime: '08:00', endTime: '12:00', label: 'Morning' },
  afternoon: { startTime: '13:00', endTime: '17:00', label: 'Afternoon' },
} as const;

/** Inclusive YYYY-MM-DD range → list of dates. */
export function eachDateInclusive(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
