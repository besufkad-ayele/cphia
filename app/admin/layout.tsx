'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import type { FeatureKey } from '@/app/lib/admin/permissions';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [admin, setAdmin] = useState<{ fullName: string; role: string; roleKey: string; permissions: FeatureKey[] } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('admin-dark');
    return () => {
      document.documentElement.classList.remove('admin-dark');
    };
  }, []);

  useEffect(() => {
    if (pathname === '/admin/login') return;
    fetch('/api/admin/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.email) {
          setAdmin({
            fullName: payload.fullName,
            role: payload.role,
            roleKey: payload.roleKey || payload.role,
            permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
          });
        }
      })
      .catch(() => null);
  }, [pathname]);

  return (
    <>
      {pathname === '/admin/login' ? (
        children
      ) : (
        <AdminShell
          name={admin?.fullName || 'Admin'}
          role={admin?.role || 'admin'}
          roleKey={admin?.roleKey || admin?.role || 'admin'}
          permissions={admin?.permissions ?? null}
        >
          {children}
        </AdminShell>
      )}
    </>
  );
}
