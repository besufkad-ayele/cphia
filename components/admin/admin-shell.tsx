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
  Radio,
  Shield,
  UserPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import {
  ADMIN_FEATURES,
  MOBILE_DOCK_PRIORITY,
  featureForAdminPath,
  firstAllowedAdminHref,
  hasFeature,
  type PermissionKey,
} from '@/app/lib/admin/permissions';
import { AttendanceFlag } from '@/components/admin/attendance-flag';
import { ConnectionStatusProvider, useConnectionStatus } from '@/components/admin/connection-status';
import { AdminMobileDock } from '@/components/admin/mobile-dock';
import { CphiaLoader } from '@/components/brand/cphia-loader';
import { CphiaLogo, CphiaMark } from '@/components/brand/cphia-logo';
import { Button } from '@/components/ui/button';
import { requestBrandTransition } from '@/app/lib/brand-transition';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

function triggerDashboardGate(pathname: string, homePath: string) {
  if (pathname === homePath) return;
  requestBrandTransition({ label: 'Loading desk' });
}

const ICONS = {
  dashboard: LayoutDashboard,
  volunteers: Users,
  teams: UsersRound,
  attendance: CalendarCheck,
  shifts: Clock3,
  floor: Radio,
  cohorts: CalendarRange,
  forms: ClipboardList,
  users: UserPlus,
  roles: Shield,
} as const;

function AdminShellInner({
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
  permissions: PermissionKey[] | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { notice } = useConnectionStatus();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setExpanded(window.localStorage.getItem('cphia.admin.nav') === 'detail');
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const session = permissions ? { role, permissions } : null;
  const homePath = session ? firstAllowedAdminHref(session) || '/admin' : '/admin';
  const requiredFeature = featureForAdminPath(pathname);
  const accessDenied = Boolean(
    session && requiredFeature && !hasFeature(session, requiredFeature),
  );
  // Hold module pages until /api/admin/me resolves so denied routes never flash "not included".
  const awaitingAccess = permissions === null && Boolean(requiredFeature);

  useEffect(() => {
    if (!accessDenied || !permissions) return;
    const next = firstAllowedAdminHref({ role, permissions });
    if (!next || next === pathname) return;
    router.replace(href(next));
  }, [accessDenied, permissions, role, pathname, router]);

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
                  onClick={() => {
                    if (item.key === 'dashboard') triggerDashboardGate(pathname, homePath);
                  }}
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
        <div className={cn('flex items-center border-b border-white/10', expanded ? 'justify-between gap-2 px-3 py-3' : 'justify-center px-3 py-4')}>
          {expanded ? (
            <div className="min-w-0 flex-1 rounded-xl px-1 py-1 transition hover:bg-white/5">
              <CphiaLogo
                href={href(homePath)}
                priority
                onClick={() => triggerDashboardGate(pathname, homePath)}
                className="h-11 w-auto max-w-full object-contain object-left"
                alt="CPHIA desk"
              />
            </div>
          ) : (
            <CphiaMark
              href={href(homePath)}
              priority
              onClick={() => triggerDashboardGate(pathname, homePath)}
              className="size-11 rounded-2xl border border-[#e7c15a]/35 bg-black/30 p-1.5 transition hover:border-[#e7c15a]/60 hover:bg-[#e7c15a]/10"
            />
          )}
          {expanded ? (
            <Button variant="ghost" size="icon" className="shrink-0 text-zinc-300" onClick={toggleExpanded} aria-label="Show icons only">
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
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/55 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-white md:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-4" />
              CPHIA desk
            </button>
            <p className="hidden text-sm text-zinc-400 md:block">Volunteer desk</p>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              {notice ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="truncate rounded-full border border-[#e7c15a]/35 bg-[#e7c15a]/10 px-3 py-1 text-xs text-[#f6e7b2] md:text-sm"
                >
                  {notice}
                </p>
              ) : null}
              <Button variant="ghost" size="sm" className="md:hidden" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 pb-28 md:p-6 md:pb-6">
          {awaitingAccess || accessDenied ? (
            <CphiaLoader size="lg" label="Opening your desk" />
          ) : children}
        </main>

        <AttendanceFlag
          hidden={!permissions || !hasFeature({ role, permissions }, 'attendance')}
          active={pathname.startsWith('/admin/attendance')}
        />

        <AdminMobileDock
          pathname={pathname}
          loading={permissions === null}
          priority={MOBILE_DOCK_PRIORITY}
          excludeKeys={['attendance']}
          items={items.map((item) => ({
            key: item.key,
            label: item.label,
            href: item.href,
            icon: ICONS[item.key],
          }))}
          onItemNavigate={(item) => {
            if (item.key === 'dashboard') triggerDashboardGate(pathname, homePath);
          }}
          onMore={items.filter((item) => item.key !== 'attendance').length > 4 ? () => setMenuOpen(true) : undefined}
        />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,320px)] flex-col border-r border-white/10 bg-black/80 p-4 backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CphiaLogo
                  href={href(homePath)}
                  priority
                  onClick={() => {
                    triggerDashboardGate(pathname, homePath);
                    setMenuOpen(false);
                  }}
                  className="h-10 w-auto max-w-full object-contain object-left"
                  alt="CPHIA desk"
                />
                <p className="mt-2 truncate text-sm text-white">{name}</p>
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

export function AdminShell(props: {
  children: React.ReactNode;
  name: string;
  role: string;
  roleKey: string;
  permissions: PermissionKey[] | null;
}) {
  return (
    <ConnectionStatusProvider>
      <AdminShellInner {...props} />
    </ConnectionStatusProvider>
  );
}
