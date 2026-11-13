/**
 * Public volunteer registration gate.
 * Set NEXT_PUBLIC_REGISTRATION_OPEN=true to reopen the /register form + API.
 * Defaults to closed.
 */
export function isRegistrationOpen() {
  const raw = process.env.NEXT_PUBLIC_REGISTRATION_OPEN;
  if (raw == null || raw === '') return false;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}
