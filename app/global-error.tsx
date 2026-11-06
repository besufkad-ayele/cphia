'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { StatusScreen, statusButtonClass } from '@/components/status/status-screen';
import { errorDigest } from '@/components/status/error-digest';
import './globals.css';

export default function GlobalError({
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
    <html lang="en">
      <body>
        <title>Something went wrong · CPHIA Volunteer Registration</title>
        <StatusScreen
          code="Application error"
          title="CPHIA registration hit a problem"
          description="The site could not finish loading. Try again. Your registration draft stays in this browser if you already started the form."
          note={digest ? `Reference ${digest}` : undefined}
        >
          <button type="button" className={statusButtonClass()} onClick={() => retry()}>
            Try again
          </button>
          <Link href="/" className={statusButtonClass('ghost')}>
            Back to home
          </Link>
        </StatusScreen>
      </body>
    </html>
  );
}
