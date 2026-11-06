export const ADMIN_STATUSES = ['pending', 'approved', 'review', 'flagged'] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export function isAdminStatus(value: string | null): value is AdminStatus {
  return ADMIN_STATUSES.includes(value as AdminStatus);
}

export function deriveAdminStatus(reviewStatus: string | null, emailStatus?: string | null, deviceFlag?: string | null): AdminStatus {
  if (reviewStatus && ADMIN_STATUSES.includes(reviewStatus as AdminStatus)) {
    return reviewStatus as AdminStatus;
  }
  if (deviceFlag === 'possible_duplicate') return 'review';
  if (emailStatus === 'sent') return 'approved';
  if (emailStatus === 'failed') return 'flagged';
  return 'pending';
}
