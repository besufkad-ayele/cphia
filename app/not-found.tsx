import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusScreen, statusButtonClass } from '@/components/status/status-screen';

export const metadata: Metadata = {
  title: 'Page not found · CPHIA Volunteer Registration',
  description: 'This address is not part of the CPHIA 2026 volunteer registration site.',
};

export default function NotFound() {
  return (
    <StatusScreen
      code="404 · Page not found"
      title="This page is not part of CPHIA 2026"
      description="The address may be mistyped, or the page may have moved. Volunteer registration and the admin desk are still available."
    >
      <Link href="/" className={statusButtonClass()}>
        Back to home
      </Link>
      <Link href="/register" className={statusButtonClass('ghost')}>
        Register as a volunteer
      </Link>
    </StatusScreen>
  );
}
