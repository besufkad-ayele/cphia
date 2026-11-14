import { isMissingTable } from '@/app/lib/admin/guard';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

const SETTING_KEY = 'registration_open';

/**
 * Optional env kill-switch / force.
 * - unset → use desk setting in the database (button on admin desk)
 * - false/0/off → force closed
 * - true/1/on → force open
 */
export function registrationOpenEnvOverride(): boolean | null {
  const raw = process.env.NEXT_PUBLIC_REGISTRATION_OPEN;
  if (raw == null || raw === '') return null;
  if (/^(0|false|no|off)$/i.test(raw.trim())) return false;
  if (/^(1|true|yes|on)$/i.test(raw.trim())) return true;
  return null;
}

/** @deprecated Prefer getRegistrationOpen() — env alone is no longer the source of truth. */
export function isRegistrationOpen() {
  const override = registrationOpenEnvOverride();
  if (override != null) return override;
  return true;
}

function readBooleanJson(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'false') return value === 'true';
  if (value && typeof value === 'object' && 'open' in (value as object)) {
    return Boolean((value as { open?: unknown }).open);
  }
  return null;
}

/**
 * Live registration gate for /register and POST /api/register.
 * Env override wins when set; otherwise the desk setting (admin toggle) is used.
 */
export async function getRegistrationOpen(): Promise<boolean> {
  const override = registrationOpenEnvOverride();
  if (override != null) return override;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ops_desk_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) return true;
      console.error('registration_open_read_error', error);
      return true;
    }

    const parsed = readBooleanJson(data?.value);
    return parsed == null ? true : parsed;
  } catch (error) {
    console.error('registration_open_read_failed', error);
    return true;
  }
}

export async function setRegistrationOpen(options: {
  open: boolean;
  updatedBy: string | null;
}): Promise<{ open: boolean }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('ops_desk_settings').upsert(
    {
      key: SETTING_KEY,
      value: options.open,
      updated_at: new Date().toISOString(),
      updated_by: options.updatedBy,
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
  return { open: options.open };
}
