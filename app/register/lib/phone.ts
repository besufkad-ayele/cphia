/** Organize Ethiopian local digits: 09… → 9…, otherwise keep as entered (max 9). */
export function organizeLocalPhoneDigits(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.startsWith('0')) return digits.slice(1, 10);
  return digits.slice(0, 9);
}

/** Normalize phone to +2519XXXXXXXX (strip leading 0 from local part). */
export function toE164Ethiopia(value: string) {
  const local = value.replace(/^\+?251/, '');
  const organized = organizeLocalPhoneDigits(local);
  return organized ? `+251${organized}` : '+251';
}

/** Same as toE164Ethiopia, but leave empty strings empty. */
export function organizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '+251') return trimmed === '+251' ? '+251' : '';
  return toE164Ethiopia(trimmed);
}
