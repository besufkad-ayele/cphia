'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { StatusScreen, statusButtonClass } from '@/components/status/status-screen';
import { errorDigest } from '@/components/status/error-digest';

export default function RegisterError({
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
    <StatusScreen
      code="Registration interrupted"
      title="The form could not be shown"
      description="Answers you already entered stay saved in this browser. Try again to return to the form. If it still fails, go home and open registration once more."
      note={digest ? `Reference ${digest}` : undefined}
    >
      <button type="button" className={statusButtonClass()} onClick={() => retry()}>
        Try again
      </button>
      <Link href="/" className={statusButtonClass('ghost')}>
        Back to home
      </Link>
    </StatusScreen>
  );
}
