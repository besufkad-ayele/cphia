import { Badge } from '@/components/ui/badge';
import type { AdminStatus } from '@/app/lib/admin/status';

const styles: Record<AdminStatus, string> = {
  pending: 'border-transparent bg-[#FFF5D9] text-[#8A6500]',
  approved: 'border-transparent bg-[#E8F8EE] text-[#067647]',
  review: 'border-transparent bg-[#EDEBFF] text-[#4737A8]',
  flagged: 'border-transparent bg-[#FDECEC] text-[#B42318]',
};

export const STATUS_LABELS: Record<AdminStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  review: 'Under review',
  flagged: 'Flagged',
};

export function StatusBadge({ status }: { status: AdminStatus }) {
  return <Badge className={styles[status]}>{STATUS_LABELS[status]}</Badge>;
}
