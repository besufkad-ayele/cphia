export function errorMessage(payload: { error?: string; message?: string } | null | undefined, fallback: string) {
  if (!payload) return fallback;
  if (payload.error === 'MIGRATION_REQUIRED') return payload.message || 'Apply the latest database migration to use this module.';
  if (payload.error === 'FORBIDDEN') return 'Your role does not include this module.';
  if (payload.error === 'DUPLICATE_EMAIL') return 'That email is already an admin account.';
  if (payload.error === 'WEAK_PASSWORD') return 'Use a password of at least 8 characters.';
  if (payload.error === 'LAST_SUPER_ADMIN') return 'Keep at least one active super admin.';
  if (payload.error === 'ROLE_IN_USE') return 'Reassign people on this role before deleting it.';
  if (payload.error === 'SELF') return 'You cannot remove your own account.';
  if (payload.error === 'NOT_FOUND') return 'That record is no longer available.';
  if (payload.message && payload.error !== 'REQUEST_FAILED') return payload.message;
  return fallback;
}

export async function adminFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(payload, 'Request failed.'));
  return payload as T;
}
