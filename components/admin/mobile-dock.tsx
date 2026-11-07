'use client';

import Link from 'next/link';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from 'react';
import { Menu } from 'lucide-react';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type DockItem = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type Marker = { left: number; width: number };

const SHORT_LABELS: Record<string, string> = {
  dashboard: 'Desk',
  volunteers: 'People',
  floor: 'Live',
  attendance: 'Marks',
  shifts: 'Shifts',
  teams: 'Crews',
  cohorts: 'Events',
  forms: 'Forms',
  users: 'Admins',
  roles: 'Roles',
};

function orderForDock(items: DockItem[], priority: string[]) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const ordered: DockItem[] = [];
  for (const key of priority) {
    const item = byKey.get(key);
    if (item) {
      ordered.push(item);
      byKey.delete(key);
    }
  }
  for (const item of byKey.values()) ordered.push(item);
  return ordered;
}

export function AdminMobileDock({
  items,
  pathname,
  loading,
  onMore,
  priority = ['dashboard', 'volunteers', 'floor', 'shifts'],
  excludeKeys = ['attendance'],
}: {
  items: DockItem[];
  pathname: string;
  loading?: boolean;
  onMore?: () => void;
  priority?: string[];
  /** Modules shown elsewhere on mobile (e.g. attendance flag). */
  excludeKeys?: string[];
}) {
  const dockItems = items.filter((item) => !excludeKeys.includes(item.key));
  const ordered = orderForDock(dockItems, priority);
  const showMore = Boolean(onMore) && ordered.length > 4;
  const visible = showMore ? ordered.slice(0, 4) : ordered.slice(0, 5);
  const railRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const [marker, setMarker] = useState<Marker>({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

  const activeIndex = visible.findIndex((item) =>
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href),
  );
  // Attendance uses the floating flag — don't light "More" for that route.
  const onFlagRoute = excludeKeys.some((key) => {
    if (key === 'attendance') return pathname.startsWith('/admin/attendance');
    return false;
  });
  const moreActive = showMore && activeIndex < 0 && pathname.startsWith('/admin') && !onFlagRoute;

  useLayoutEffect(() => {
    function measure() {
      const rail = railRef.current;
      if (!rail) return;
      const targetIndex = moreActive ? visible.length : activeIndex;
      const node = itemRefs.current[targetIndex];
      if (!node || targetIndex < 0) {
        setMarker({ left: 0, width: 0 });
        return;
      }
      const railBox = rail.getBoundingClientRect();
      const itemBox = node.getBoundingClientRect();
      setMarker({
        left: itemBox.left - railBox.left + itemBox.width * 0.18,
        width: itemBox.width * 0.64,
      });
      setReady(true);
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeIndex, moreActive, pathname, visible.length, loading]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <nav className="admin-mobile-dock md:hidden" aria-label="Primary">
      <div className="admin-mobile-dock__halo" aria-hidden />
      <div className="admin-mobile-dock__shell">
        <div className="admin-mobile-dock__filament" aria-hidden />
        <div ref={railRef} className="admin-mobile-dock__rail">
          <span
            className={cn('admin-mobile-dock__marker', ready && 'is-ready')}
            style={{
              transform: `translate3d(${marker.left}px, 0, 0)`,
              width: marker.width || 0,
            }}
            aria-hidden
          />

          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="admin-mobile-dock__skeleton" />
              ))
            : visible.map((item, index) => {
                const active =
                  item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={href(item.href)}
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'admin-mobile-dock__item',
                      active && 'is-active',
                      pressed === item.key && 'is-pressed',
                    )}
                    style={{ animationDelay: `${80 + index * 55}ms` }}
                    onPointerDown={() => setPressed(item.key)}
                    onPointerUp={() => setPressed(null)}
                    onPointerLeave={() => setPressed(null)}
                    onPointerCancel={() => setPressed(null)}
                  >
                    <span className="admin-mobile-dock__icon-wrap">
                      <Icon className="admin-mobile-dock__icon" />
                    </span>
                    <span className="admin-mobile-dock__label">
                      {SHORT_LABELS[item.key] ?? item.label}
                    </span>
                  </Link>
                );
              })}

          {!loading && showMore ? (
            <button
              type="button"
              ref={(node) => {
                itemRefs.current[visible.length] = node;
              }}
              className={cn(
                'admin-mobile-dock__item admin-mobile-dock__more',
                moreActive && 'is-active',
                pressed === 'more' && 'is-pressed',
              )}
              style={{ animationDelay: `${80 + visible.length * 55}ms` }}
              onClick={onMore}
              onPointerDown={() => setPressed('more')}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              onPointerCancel={() => setPressed(null)}
            >
              <span className="admin-mobile-dock__icon-wrap">
                <Menu className="admin-mobile-dock__icon" />
              </span>
              <span className="admin-mobile-dock__label">More</span>
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
