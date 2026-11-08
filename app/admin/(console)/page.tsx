'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, CalendarRange, ClipboardList, Clock3, Users } from 'lucide-react';
import { HEALTH_SUBSECTORS, SECTORS } from '@cphia/shared/constants';
import type { DemographicsSummary } from '@/app/lib/admin/demographics';
import type { RegistrationMetrics, RegistrationSummary } from '@/app/lib/admin/types';
import { adminFetch } from '@/app/lib/admin/messages';
import {
  overviewCacheKey,
  readOverviewCache,
  writeOverviewCache,
} from '@/app/lib/admin/dashboard-cache';
import { hasCapability, hasFeature } from '@/app/lib/admin/permissions';
import { useConnectionStatus } from '@/components/admin/connection-status';
import { DashboardDemographics } from '@/components/admin/dashboard-charts';
import { StatusBadge } from '@/components/admin/status-badge';
import { Banner, PageHeader, controlClass } from '@/components/admin/console';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { href } from '@/lib/app-href';

const emptyMetrics: RegistrationMetrics = { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 };
const POLL_MS = 2000;
/** Overview often takes 1.5–3s on localhost; only warn when it clearly stalls. */
const SLOW_MS = 4500;

type BoardShift = {
  id: string;
  name: string;
  location: string;
  start: string;
  end: string;
  capacity: number;
  present: number;
  cohort: string;
};

type BreakdownRow = { name: string; count: number };

type Overview = {
  metrics: RegistrationMetrics;
  recent: RegistrationSummary[];
  breakdown: { sectors: BreakdownRow[]; subsectors: BreakdownRow[] };
  demographics: DemographicsSummary;
  filters: { sector: string | null; subsector: string | null };
  cohorts: number;
  shiftsToday: number;
  checkedInToday: number;
  formsPublished: number;
  team: number;
  todayBoard: BoardShift[];
  migrationRequired: boolean;
  permissions: string[];
  role: string;
};

function volunteersHref(sector: string, subsector?: string) {
  const params = new URLSearchParams();
  if (sector) params.set('sector', sector);
  if (subsector) params.set('subsector', subsector);
  const query = params.toString();
  return href(query ? `/admin/volunteers?${query}` : '/admin/volunteers');
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState('');
  const [subsector, setSubsector] = useState('');
  const { setNotice } = useConnectionStatus();
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let controller: AbortController | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    let loadedOnce = false;
    const cacheKey = overviewCacheKey(sector, subsector);
    const cached = readOverviewCache<Overview>(cacheKey);
    if (cached) {
      setData(cached);
      hasDataRef.current = true;
      loadedOnce = true;
      setLoading(false);
      setError(null);
    } else {
      hasDataRef.current = false;
    }

    async function load(initial: boolean) {
      // Use a local busy flag (not a remount-surviving ref) so React Strict Mode
      // remounts can fetch again instead of getting stuck on the loading skeleton.
      if (cancelled || busy) return;
      busy = true;
      if (initial && !loadedOnce) setLoading(true);

      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;

      if (slowTimer) clearTimeout(slowTimer);
      slowTimer = setTimeout(() => {
        if (!cancelled) setNotice('Connection is slow — still syncing dashboard…');
      }, SLOW_MS);

      const date = new Date().toLocaleDateString('en-CA');
      const params = new URLSearchParams({ date });
      if (sector) params.set('sector', sector);
      if (subsector) params.set('subsector', subsector);

      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('OFFLINE');
        }
        const next = await adminFetch<Overview>(`/api/admin/overview?${params}`, { signal });
        if (cancelled || signal.aborted) return;
        loadedOnce = true;
        hasDataRef.current = true;
        setData(next);
        writeOverviewCache(cacheKey, next);
        setError(null);
        setNotice(null);
      } catch (reason) {
        if (cancelled || signal.aborted) return;
        const isAbort =
          (reason instanceof DOMException && reason.name === 'AbortError') ||
          (reason instanceof Error && reason.name === 'AbortError');
        if (isAbort) return;
        const offline =
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          (reason instanceof Error && reason.message === 'OFFLINE');
        if (hasDataRef.current || cached) {
          setNotice(
            offline
              ? 'Offline — showing last saved dashboard numbers.'
              : 'Sync delayed — retrying with current numbers on screen.',
          );
          setError(null);
        } else {
          setError(offline ? 'No connection and no cached dashboard yet.' : reason instanceof Error ? reason.message : 'Could not sync dashboard.');
          setNotice(null);
        }
      } finally {
        if (slowTimer) {
          clearTimeout(slowTimer);
          slowTimer = null;
        }
        busy = false;
        if (!cancelled && initial) setLoading(false);
      }
    }

    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, POLL_MS);

    function onOnline() {
      void load(false);
    }
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      controller?.abort();
      if (slowTimer) clearTimeout(slowTimer);
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      setNotice(null);
    };
  }, [sector, subsector, setNotice]);

  const metrics = data?.metrics ?? emptyMetrics;
  const session = { role: data?.role || 'admin', permissions: data?.permissions ?? [] };
  const showMetrics = !data || hasCapability(session, 'dashboard.metrics');
  const showGender = !data || hasCapability(session, 'dashboard.gender');
  const showGenderSector = !data || hasCapability(session, 'dashboard.gender_sector');
  const showAge = !data || hasCapability(session, 'dashboard.age');
  const showEducation = !data || hasCapability(session, 'dashboard.education');
  const showSectors = !data || hasCapability(session, 'dashboard.sectors');
  const showFloor = !data || hasCapability(session, 'dashboard.floor');
  const showRecent = !data || hasCapability(session, 'dashboard.recent');
  const cards = [
    { label: 'Volunteers', value: metrics.total, note: `${metrics.pending} pending · ${metrics.approved} approved`, href: volunteersHref(sector, subsector), icon: Users, feature: 'volunteers' as const },
    { label: 'On duty today', value: data?.shiftsToday ?? 0, note: `${data?.checkedInToday ?? 0} checked in`, href: href('/admin/attendance'), icon: CalendarCheck, feature: 'attendance' as const },
    { label: 'Open cohorts', value: data?.cohorts ?? 0, note: 'Planning, live, and active events', href: href('/admin/cohorts'), icon: CalendarRange, feature: 'cohorts' as const },
    { label: 'Live forms', value: data?.formsPublished ?? 0, note: 'Published briefings and checklists', href: href('/admin/forms'), icon: ClipboardList, feature: 'forms' as const },
    { label: 'Shifts', value: data?.shiftsToday ?? 0, note: 'Roster blocks scheduled today', href: href('/admin/shifts'), icon: Clock3, feature: 'shifts' as const },
  ].filter((card) => showMetrics && (!data || hasFeature(session, card.feature)));

  const showHealthSubs = sector === 'Health';
  const filterNote = [sector || null, subsector || null].filter(Boolean).join(' · ') || 'All sectors';

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="CPHIA-26 COHORT"
        title="Desk at a glance"
        description="Filter by sector and health sub-sector to see counts, gender, age, education charts, and jump into the matching volunteer list."
      >
        <div className={`grid gap-2 ${showHealthSubs ? 'sm:grid-cols-2' : ''}`}>
          <label className="grid gap-1 text-xs text-zinc-400">
            Sector
            <select
              className={controlClass}
              value={sector}
              onChange={(event) => {
                const next = event.target.value;
                setSector(next);
                if (next !== 'Health') setSubsector('');
              }}
            >
              <option value="">All sectors</option>
              {SECTORS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          {showHealthSubs ? (
            <label className="grid gap-1 text-xs text-zinc-400">
              Health sub-sector
              <select
                className={controlClass}
                value={subsector}
                onChange={(event) => setSubsector(event.target.value)}
              >
                <option value="">All sub-sectors</option>
                {HEALTH_SUBSECTORS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </PageHeader>
      <Banner message={error || (data?.migrationRequired ? 'Apply supabase/migrations/009_ops_modules.sql to turn on attendance, shifts, cohorts, forms, and roles.' : null)} />
      <p className="text-sm text-zinc-400">Showing: <span className="text-[#f6e7b2]">{filterNote}</span></p>

      {showMetrics ? (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}><CardHeader><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></CardHeader></Card>
            ))
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={card.href}>
                  <Card className="h-full transition hover:ring-[#e7c15a]/40">
                    <CardHeader>
                      <CardDescription className="flex items-center gap-2"><Icon className="size-4 text-[#e7c15a]" />{card.label}</CardDescription>
                      <CardTitle className="text-3xl text-white">{card.value}</CardTitle>
                      <p className="text-xs text-zinc-400">{card.note}</p>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
      </div>
      ) : null}

      <DashboardDemographics
        data={data?.demographics ?? null}
        loading={loading}
        total={metrics.total}
        showGender={showGender}
        showGenderBySector={showGenderSector}
        showAge={showAge}
        showEducation={showEducation}
      />

      {showSectors || showFloor ? (
      <div className={`grid gap-4 ${[showSectors, showSectors, showFloor].filter(Boolean).length > 1 ? 'xl:grid-cols-[1fr_1fr_1fr]' : ''}`}>
        {showSectors ? (
        <Card>
          <CardHeader>
            <CardTitle>By sector</CardTitle>
            <CardDescription>Registration counts for the current filter.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {loading ? <Skeleton className="h-16 w-full" /> : null}
            {(data?.breakdown.sectors ?? []).map((row) => (
              <Link
                key={row.name}
                href={volunteersHref(row.name)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm hover:bg-white/5"
              >
                <span className="text-white">{row.name}</span>
                <span className="text-[#f6e7b2]">{row.count}</span>
              </Link>
            ))}
            {!loading && (data?.breakdown.sectors.length ?? 0) === 0 ? (
              <p className="text-sm text-zinc-400">No registrations match this filter.</p>
            ) : null}
          </CardContent>
        </Card>
        ) : null}

        {showSectors ? (
        <Card>
          <CardHeader>
            <CardTitle>Health sub-sectors</CardTitle>
            <CardDescription>Useful when staffing facility vs public-health roles.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {loading ? <Skeleton className="h-16 w-full" /> : null}
            {(data?.breakdown.subsectors ?? []).map((row) => (
              <Link
                key={row.name}
                href={volunteersHref('Health', row.name)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm hover:bg-white/5"
              >
                <span className="text-white">{row.name}</span>
                <span className="text-[#f6e7b2]">{row.count}</span>
              </Link>
            ))}
            {!loading && (data?.breakdown.subsectors.length ?? 0) === 0 ? (
              <p className="text-sm text-zinc-400">No health sub-sector data in this filter.</p>
            ) : null}
          </CardContent>
        </Card>
        ) : null}

        {showFloor ? (
        <Card>
          <CardHeader>
            <CardTitle>Today’s floor</CardTitle>
            <CardDescription>Shifts scheduled for today and how many people are marked in.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {loading ? <Skeleton className="h-16 w-full" /> : null}
            {(data?.todayBoard ?? []).map((shift) => (
              <Link key={shift.id} href={href(`/admin/attendance?shiftId=${shift.id}`)} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm hover:bg-white/5">
                <div>
                  <p className="font-medium text-white">{shift.name}</p>
                  <p className="text-xs text-zinc-400">{shift.cohort} · {shift.start}–{shift.end} · {shift.location}</p>
                </div>
                <p className="text-right text-sm text-[#f6e7b2]">{shift.present}{shift.capacity ? ` / ${shift.capacity}` : ''}</p>
              </Link>
            ))}
            {!loading && (data?.todayBoard.length ?? 0) === 0 ? (
              <p className="text-sm text-zinc-400">No shifts on today’s date yet. Add one from Shifts.</p>
            ) : null}
          </CardContent>
        </Card>
        ) : null}
      </div>
      ) : null}

      {showRecent ? (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Recent registrations</CardTitle>
            <CardDescription>{metrics.review + metrics.flagged} still need a review look in this filter.</CardDescription>
          </div>
          <Link href={volunteersHref(sector, subsector)} className="text-sm text-[#e7c15a]">View filtered list</Link>
        </CardHeader>
        <CardContent className="grid gap-2">
          {loading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />) : null}
          {(data?.recent ?? []).map((row) => (
            <Link key={row.id} href={href(`/admin/volunteers/${row.id}`)} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{row.name}</p>
                <p className="truncate text-xs text-zinc-400">
                  {row.registrationId} · {row.sector}
                  {(row.healthSubsectors?.length ?? 0) > 0 ? ` · ${row.healthSubsectors?.join(', ')}` : ''}
                  {row.cohort ? ` · ${row.cohort}` : ''}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </Link>
          ))}
          {!loading && (data?.recent.length ?? 0) === 0 ? <p className="text-sm text-zinc-400">No recent volunteers for this filter.</p> : null}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
