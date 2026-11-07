import type { SupabaseClient } from '@supabase/supabase-js';

type ShiftRow = {
  id: string;
  kind: string | null;
  team_id: string | null;
  cohort_id: string;
  sheet_status: string | null;
  ops_cohorts?: { code?: string } | { code?: string }[] | null;
};

function cohortCode(shift: ShiftRow) {
  const join = shift.ops_cohorts;
  if (Array.isArray(join)) return join[0]?.code || '';
  return join?.code || '';
}

/** Audience for a shift: team members (ops) or approved volunteers on the cohort (training). */
export async function loadShiftAudience(
  supabase: SupabaseClient,
  shift: ShiftRow,
): Promise<Array<{ id: string }>> {
  if (shift.kind === 'ops' && shift.team_id) {
    const { data, error } = await supabase
      .from('ops_team_members')
      .select('registration_id, registrations!inner(id, review_status)')
      .eq('team_id', shift.team_id);
    if (error) throw error;
    return (data ?? [])
      .map((row) => {
        const person = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
        if (!person || person.review_status !== 'approved') return null;
        return { id: String(row.registration_id) };
      })
      .filter((row): row is { id: string } => Boolean(row));
  }

  const code = cohortCode(shift);
  let query = supabase
    .from('registrations')
    .select('id')
    .eq('review_status', 'approved');
  if (code) query = query.eq('cohort', code);
  const { data, error } = await query.limit(5000);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id }));
}

/** Ensure every audience member has an attendance row; new rows default to absent. */
export async function seedAbsentRows(
  supabase: SupabaseClient,
  shift: ShiftRow,
  markedBy: string | null,
) {
  if (shift.sheet_status === 'verified') return { seeded: 0 };

  const audience = await loadShiftAudience(supabase, shift);
  if (!audience.length) return { seeded: 0 };

  const { data: existing, error: existingError } = await supabase
    .from('ops_attendance')
    .select('registration_id')
    .eq('shift_id', shift.id);
  if (existingError) throw existingError;

  const have = new Set((existing ?? []).map((row) => row.registration_id));
  const missing = audience.filter((person) => !have.has(person.id));
  if (!missing.length) return { seeded: 0 };

  const now = new Date().toISOString();
  const rows = missing.map((person) => ({
    shift_id: shift.id,
    registration_id: person.id,
    status: 'absent',
    notes: '',
    marked_by: markedBy,
    checked_in_at: null,
    updated_at: now,
  }));

  const { error } = await supabase.from('ops_attendance').upsert(rows, {
    onConflict: 'shift_id,registration_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
  return { seeded: rows.length };
}
