export const ADMIN_STATUSES = ['pending', 'approved', 'review', 'flagged'] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export function isAdminStatus(value: string | null): value is AdminStatus {
  return ADMIN_STATUSES.includes(value as AdminStatus);
}

export function deriveAdminStatus(emailStatus: string | null, deviceFlag: string | null): AdminStatus {
  if (deviceFlag === 'possible_duplicate') return 'review';
  if (emailStatus === 'sent') return 'approved';
  if (emailStatus === 'failed') return 'flagged';
  return 'pending';
}

export function statusFilterClause(status: AdminStatus) {
  if (status === 'review') {
    return { column: 'device_flag' as const, value: 'possible_duplicate' };
  }
  if (status === 'approved') {
    return { column: 'email_status' as const, value: 'sent' };
  }
  if (status === 'flagged') {
    return { column: 'email_status' as const, value: 'failed' };
  }
  return { column: 'email_status' as const, value: 'pending' };
}
