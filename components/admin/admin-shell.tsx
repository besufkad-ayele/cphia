'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ADMIN_FEATURES, hasFeature, type FeatureKey } from '@/app/lib/admin/permissions';
import { Button } from '@/components/ui/button';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

const ICONS = {
  dashboard: LayoutDashboard,
  volunteers: Users,
  attendance: CalendarCheck,
  shifts: Clock3,
  cohorts: CalendarRange,
  forms: ClipboardList,
  users: UserPlus,
  roles: Shield,
} as const;

export function AdminShell({
  children,
  name,
  role,
  roleKey,
  permissions,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  roleKey: string;
  permissions: FeatureKey[] | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setExpanded(window.localStorage.getItem('cphia.admin.nav') === 'detail');
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      window.localStorage.setItem('cphia.admin.nav', next ? 'detail' : 'icons');
      return next;
    });
  }

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  const items = ADMIN_FEATURES.filter((item) => permissions && hasFeature({ role, permissions }, item.key));
  const roleLabel = (roleKey || role).replace(/_/g, ' ');

  function NavLinks({ detailed }: { detailed: boolean }) {
    return (
      <>
        {permissions === null
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={cn('animate-pulse rounded-2xl bg-white/8', detailed ? 'h-14' : 'size-11')} />
            ))
          : items.map((item) => {
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              const Icon = ICONS[item.key];
              return (
                <Link
                  key={item.href}
                  href={href(item.href)}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex rounded-2xl text-sm transition',
                    detailed ? 'items-start gap-3 px-3 py-2.5' : 'size-11 items-center justify-center',
                    active
                      ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(231,193,90,0.45)]'
                      : 'text-zinc-300 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <Icon className={cn('size-[18px] shrink-0', active && 'text-[#e7c15a]', detailed && 'mt-0.5')} />
                  {detailed ? (
                    <span className="min-w-0">
                      <span className="block font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-zinc-400">{item.detail}</span>
                    </span>
                  ) : (
                    <span className="sr-only">{item.label}</span>
                  )}
                </Link>
              );
            })}
      </>
    );
  }

  return (
    <div className="admin-dark min-h-screen text-foreground">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/10 bg-black/45 backdrop-blur-2xl md:flex',
          expanded ? 'w-[280px]' : 'w-[92px]',
        )}
      >
        <div className={cn('flex items-center border-b border-white/10', expanded ? 'justify-between px-4 py-4' : 'justify-center px-3 py-4')}>
          {expanded ? (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e7c15a]">CPHIA 2026</p>
              <p className="mt-1 text-sm font-medium text-white">Volunteer desk</p>
            </div>
          ) : (
            <span className="grid size-10 place-items-center rounded-2xl border border-[#e7c15a]/40 bg-[#e7c15a]/10 text-sm font-semibold text-[#e7c15a]">C</span>
          )}
          {expanded ? (
            <Button variant="ghost" size="icon" className="text-zinc-300" onClick={toggleExpanded} aria-label="Show icons only">
              <PanelLeftClose />
            </Button>
          ) : null}
        </div>
        {!expanded ? (
          <div className="flex justify-center pt-3">
            <Button variant="ghost" size="icon" className="text-zinc-300" onClick={toggleExpanded} aria-label="Expand sidebar details">
              <PanelLeftOpen />
            </Button>
          </div>
        ) : null}
        <nav className={cn('flex flex-1 flex-col gap-1 overflow-y-auto p-3', !expanded && 'items-center')}>
          <NavLinks detailed={expanded} />
        </nav>
        <div className={cn('border-t border-white/10 p-3', !expanded && 'flex flex-col items-center')}>
          {expanded ? (
            <>
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="truncate text-xs capitalize text-zinc-400">{roleLabel}</p>
            </>
          ) : null}
          <Button variant="ghost" className={cn('text-zinc-300', expanded ? 'mt-3 h-10 w-full justify-start' : 'size-11')} onClick={() => void signOut()}>
            <LogOut className="size-4" />
            {expanded ? 'Sign out' : <span className="sr-only">Sign out</span>}
          </Button>
        </div>
      </aside>

      <div className={cn('flex min-h-screen flex-col', expanded ? 'md:pl-[280px]' : 'md:pl-[92px]')}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl md:hidden">
          <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-white" onClick={() => setMenuOpen(true)}>
            <Menu className="size-4" />
            CPHIA desk
          </button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,320px)] flex-col border-r border-white/10 bg-black/80 p-4 backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e7c15a]">CPHIA 2026</p>
                <p className="text-sm text-white">{name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X />
              </Button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              <NavLinks detailed />
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
