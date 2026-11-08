/** Columns for attendance reports / export (verified sheets only). */

export const ATTENDANCE_MARK_COLUMNS = [
  { id: 'status', label: 'Attendance status' },
  { id: 'notes', label: 'Attendance notes' },
  { id: 'checked_in_at', label: 'Checked in at' },
  { id: 'updated_at', label: 'Mark updated at' },
  { id: 'shift_name', label: 'Shift name' },
  { id: 'shift_date', label: 'Shift date' },
  { id: 'period', label: 'Period (morning/afternoon)' },
  { id: 'start_time', label: 'Shift start' },
  { id: 'end_time', label: 'Shift end' },
  { id: 'shift_kind', label: 'Shift kind' },
  { id: 'sheet_status', label: 'Sheet status' },
  { id: 'location', label: 'Location' },
  { id: 'team_name', label: 'Floor team' },
  { id: 'cohort_code', label: 'Event / cohort code' },
  { id: 'cohort_name', label: 'Event / cohort name' },
] as const;

/** Registration fields commonly needed beside attendance marks. */
export const ATTENDANCE_PERSON_COLUMNS = [
  { id: 'registration_id', label: 'Registration ID' },
  { id: 'first_name', label: 'Given name' },
  { id: 'middle_name', label: 'Father name' },
  { id: 'last_name', label: 'Grandfather name' },
  { id: 'full_name_amharic', label: 'Full name (Amharic)' },
  { id: 'sex', label: 'Gender' },
  { id: 'age', label: 'Age' },
  { id: 'phone', label: 'Phone' },
  { id: 'secondary_phone', label: 'Secondary phone' },
  { id: 'email', label: 'Email' },
  { id: 'fan_number', label: 'FAN number' },
  { id: 'sector', label: 'Sector' },
  { id: 'health_subsectors', label: 'Health sub-sector' },
  { id: 'profession', label: 'Profession' },
  { id: 'residence_region', label: 'Region' },
  { id: 'bank_name', label: 'Bank' },
  { id: 'bank_account_name', label: 'Account owner name' },
  { id: 'bank_account_number', label: 'Account number' },
  { id: 'cohort', label: 'Volunteer cohort code' },
] as const;

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
  'bank_account_name',
  'bank_account_number',
  'status',
  'shift_name',
  'shift_date',
  'period',
  'checked_in_at',
  'notes',
];

export function shiftPeriod(startTime: string | null | undefined): 'morning' | 'afternoon' {
  const hour = Number(String(startTime ?? '00').slice(0, 2));
  if (!Number.isFinite(hour)) return 'morning';
  return hour < 13 ? 'morning' : 'afternoon';
}

export function periodLabel(period: 'morning' | 'afternoon') {
  return period === 'morning' ? 'Morning' : 'Afternoon';
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
