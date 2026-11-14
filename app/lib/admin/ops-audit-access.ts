/** Desk-owner-only controls (ops audit, registration open/close). */
export const DESK_OWNER_EMAILS = ['ayebesufkad@gmail.com'] as const;

/** @deprecated Use DESK_OWNER_EMAILS */
export const OPS_AUDIT_VIEWER_EMAILS = DESK_OWNER_EMAILS;

export function isDeskOwner(session: { role?: string; email?: string } | null | undefined) {
  if (!session || session.role !== 'super_admin') return false;
  const email = String(session.email || '').trim().toLowerCase();
  return (DESK_OWNER_EMAILS as readonly string[]).includes(email);
}

export function canViewOpsAudit(session: { role?: string; email?: string } | null | undefined) {
  return isDeskOwner(session);
}

/** Open/close public /register — same desk owner only. */
export function canControlRegistrationGate(
  session: { role?: string; email?: string } | null | undefined,
) {
  return isDeskOwner(session);
}
