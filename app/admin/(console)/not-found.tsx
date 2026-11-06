import Link from 'next/link';
import { AdminStatus } from '@/components/status/admin-status';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AdminNotFound() {
  return (
    <AdminStatus
      code="404 · Not found"
      title="That admin page is not available"
      description="The volunteer record or admin screen you opened is missing. It may have been removed, or the link may be incomplete."
    >
      <Link href="/admin/volunteers" className={cn(buttonVariants(), 'h-11')}>
        Back to volunteers
      </Link>
      <Link href="/admin" className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
        Dashboard
      </Link>
    </AdminStatus>
  );
}
