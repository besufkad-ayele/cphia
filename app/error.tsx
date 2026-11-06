'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { StatusScreen, statusButtonClass } from '@/components/status/status-screen';
import { errorDigest } from '@/components/status/error-digest';

export default function ErrorPage({
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
      code="Something went wrong"
      title="This page could not be shown"
      description="A temporary problem stopped this screen from loading. Try again. If it keeps happening, go back home and continue from there."
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
