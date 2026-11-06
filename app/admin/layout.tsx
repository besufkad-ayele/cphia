'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [admin, setAdmin] = useState<{ fullName: string; role: string } | null>(null);

  useEffect(() => {
    if (pathname === '/admin/login') return;
    fetch('/api/admin/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.email) setAdmin({ fullName: payload.fullName, role: payload.role });
      })
      .catch(() => null);
  }, [pathname]);

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <AdminShell name={admin?.fullName || 'Admin'} role={admin?.role || 'admin'}>
      {children}
    </AdminShell>
  );
}
