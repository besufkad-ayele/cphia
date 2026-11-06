'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AdminStatus } from '@/components/status/admin-status';
import { errorDigest } from '@/components/status/error-digest';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AdminError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = errorDigest(error);

  return (
    <AdminStatus
      code="Admin error"
      title="This admin screen could not load"
      description="The volunteer desk hit a problem while rendering this page. Try again, or return to the dashboard. Signed-in access is unchanged."
      note={digest ? `Reference ${digest}` : undefined}
    >
      <Button className="h-11" onClick={() => retry()}>
        Try again
      </Button>
      <Link href="/admin" className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
        Back to dashboard
      </Link>
    </AdminStatus>
  );
}
