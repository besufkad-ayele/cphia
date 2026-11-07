'use client';

import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

/** Floating right-edge attendance flag for mobile — sits above the bottom dock. */
export function AttendanceFlag({
  active,
  hidden,
}: {
  active?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <Link
      href={href('/admin/attendance')}
      aria-label="Attendance"
      aria-current={active ? 'page' : undefined}
      className={cn('admin-attendance-flag max-lg:flex hidden', active && 'is-active')}
    >
      <span className="admin-attendance-flag__cloth">
        <CalendarCheck className="admin-attendance-flag__icon" aria-hidden />
        <span className="admin-attendance-flag__text">
          <span className="admin-attendance-flag__kicker">FLOOR</span>
          <span className="admin-attendance-flag__title">Attendance</span>
        </span>
      </span>
      <span className="admin-attendance-flag__pole" aria-hidden />
    </Link>
  );
}
