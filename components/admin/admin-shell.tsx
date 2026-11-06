'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/admin' as const, label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/volunteers' as const, label: 'Volunteers', icon: Users },
];

export function AdminShell({
  children,
  name,
  role,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/admin/logout');
    router.replace('/admin/login');
  }

  return (
    <div className="min-h-screen bg-muted/40 md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-sidebar-primary">CPHIA 2026</p>
          <h1 className="mt-1 text-lg font-semibold">Volunteer cohort</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={href(item.href)}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/70',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs capitalize text-sidebar-foreground/70">{role.replace('_', ' ')}</p>
          <Button variant="ghost" className="mt-3 h-10 w-full justify-start text-sidebar-foreground" onClick={() => void signOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Menu className="size-4" />
            <strong>CPHIA Admin</strong>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href(item.href)}
              className={cn('flex h-14 flex-col items-center justify-center gap-1 text-xs font-medium', active ? 'text-primary' : 'text-muted-foreground')}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
