'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SECTORS } from '@cphia/shared/constants';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { CphiaLoader } from '@/components/brand/cphia-loader';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type Cohort = { id: string; name: string; code: string };
type TeamRollup = {
  teamId: string;
  teamName: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  gap: number;
  shifts: number;
};
type FloorShift = {
  id: string;
  name: string;
  start: string;
  end: string;
  location: string;
  kind: string;
  sheetStatus: string;
  capacity: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  checkedIn: number;
  totalMarked: number;
  gap: number;
  phase: 'live' | 'upcoming' | 'ended';
  sectorLabel?: string;
  cohort: { id: string; name: string; code: string } | null;
  team: { id: string; name: string; code: string } | null;
};

type FloorPayload = {
  date: string;
  time?: string;
  sector?: string | null;
  totals: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    gap: number;
    shifts: number;
    people?: number;
    live?: number;
    checkedIn?: number;
  };
  shifts: FloorShift[];
  live?: FloorShift[];
  nextUp?: FloorShift | null;
  teams: TeamRollup[];
  cohorts: Cohort[];
};

function localToday() {
  return new Date().toLocaleDateString('en-CA');
}

function localNowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function ShiftCard({ shift }: { shift: FloorShift }) {
  const live = shift.phase === 'live';
  return (
    <div
      className={cn(
        'grid gap-3 rounded-2xl border px-4 py-3',
        live
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-white/10 bg-black/25',
      )}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium text-white">
          <span className="truncate">{shift.name}</span>
          {live ? (
            <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
              Live
            </span>
          ) : shift.phase === 'upcoming' ? (
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
              Up next
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
              Ended
            </span>
          )}
        </p>
        <p className="text-sm text-zinc-400">
          {shift.start}–{shift.end}
          {shift.team ? ` · ${shift.team.name}` : ' · training'}
          {shift.cohort ? ` · ${shift.cohort.code}` : ''}
          {shift.sectorLabel ? ` · ${shift.sectorLabel}` : ''}
          {' · '}{shift.sheetStatus}
          {shift.location ? ` · ${shift.location}` : ''}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          present {shift.present} · late {shift.late} · absent {shift.absent} · excused {shift.excused}
          {shift.capacity > 0 ? ` · capacity ${shift.capacity}` : ''}
          {' · '}marked {shift.totalMarked}
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={cn('text-3xl font-semibold', shift.gap > 0 ? 'text-rose-300' : 'text-emerald-300')}>
            {shift.gap}
          </p>
          <p className="text-xs text-zinc-400">Capacity gap</p>
        </div>
        <Link
          href={href(`/admin/attendance?shiftId=${shift.id}`)}
          className={cn(buttonVariants({ variant: live ? 'default' : 'outline', size: 'sm' }), 'w-full sm:w-fit')}
        >
          Open sheet
        </Link>
      </div>
    </div>
  );
}

function FloorPageInner() {
  const searchParams = useSearchParams();
  const initialSector = searchParams.get('sector') || '';
  const [date, setDate] = useState(localToday);
  const [cohortId, setCohortId] = useState('');
  const [sector, setSector] = useState(
    (SECTORS as readonly string[]).includes(initialSector) ? initialSector : '',
  );
  const [data, setData] = useState<FloorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(nextDate = date, nextCohort = cohortId, nextSector = sector) {
    const params = new URLSearchParams({
      date: nextDate,
      time: localNowTime(),
    });
    if (nextCohort) params.set('cohortId', nextCohort);
    if (nextSector) params.set('sector', nextSector);
    setData(await adminFetch<FloorPayload>(`/api/admin/floor?${params}`));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, cohortId, sector]);

  const liveShifts = useMemo(
    () => data?.live ?? data?.shifts.filter((shift) => shift.phase === 'live') ?? [],
    [data],
  );
  const upcomingShifts = useMemo(
    () => data?.shifts.filter((shift) => shift.phase === 'upcoming') ?? [],
    [data],
  );
  const endedShifts = useMemo(
    () => data?.shifts.filter((shift) => shift.phase === 'ended') ?? [],
    [data],
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="LIVE"
        title="Live floor"
        description="Active shifts first, then up next. Unique people for the day (morning or afternoon counts once). Refreshes every 30 seconds."
      >
        <Link
          href={href('/admin/attendance/reports')}
          className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}
        >
          Attendance reports
        </Link>
      </PageHeader>
      <Banner message={error} />
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <input className={controlClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Event / cohort">
            <select className={controlClass} value={cohortId} onChange={(event) => setCohortId(event.target.value)}>
              <option value="">All</option>
              {(data?.cohorts ?? []).map((cohort) => (
                <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Sector">
            <select className={controlClass} value={sector} onChange={(event) => setSector(event.target.value)}>
              <option value="">All sectors</option>
              {SECTORS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="button" className={cn(buttonVariants({ variant: 'outline' }), 'h-11 w-full')} onClick={() => void load()}>
              Refresh now
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Card><CardHeader><CardTitle className="text-2xl text-emerald-300 sm:text-3xl">{data?.totals.live ?? liveShifts.length}</CardTitle><p className="text-sm text-zinc-400">Live now</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl sm:text-3xl">{data?.totals.shifts ?? 0}</CardTitle><p className="text-sm text-zinc-400">Shifts today</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl text-emerald-300 sm:text-3xl">{data?.totals.checkedIn ?? data?.totals.present ?? 0}</CardTitle><p className="text-sm text-zinc-400">Checked in (people)</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl text-[#e7c15a] sm:text-3xl">{data?.totals.late ?? 0}</CardTitle><p className="text-sm text-zinc-400">Late (people)</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl text-zinc-200 sm:text-3xl">{data?.totals.absent ?? 0}</CardTitle><p className="text-sm text-zinc-400">Absent (people)</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl text-rose-300 sm:text-3xl">{data?.totals.gap ?? 0}</CardTitle><p className="text-sm text-zinc-400">Capacity gap</p></CardHeader></Card>
      </div>

      {data?.nextUp ? (
        <Card>
          <CardHeader>
            <CardTitle>Up next</CardTitle>
          </CardHeader>
          <CardContent>
            <ShiftCard shift={data.nextUp} />
          </CardContent>
        </Card>
      ) : null}

      {(data?.teams.length ?? 0) > 0 ? (
        <Card>
          <CardHeader><CardTitle>By floor team</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data?.teams.map((team) => (
              <div key={team.teamId} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-white">{team.teamName}</p>
                  <Link href={href(`/admin/teams/${team.teamId}`)} className="shrink-0 text-xs text-[#e7c15a]">Open</Link>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {team.shifts} shift{team.shifts === 1 ? '' : 's'} · present {team.present} · late {team.late} · absent {team.absent}
                  {team.gap > 0 ? ` · gap ${team.gap}` : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Live now · {date}{data?.time ? ` · ${data.time}` : ''}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {liveShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)}
          {liveShifts.length === 0 ? (
            <p className="text-sm text-zinc-400 sm:col-span-2">
              No shift is in progress right now
              {data?.nextUp ? ` — next is ${data.nextUp.name} at ${data.nextUp.start}.` : '.'}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {upcomingShifts.length ? (
        <Card>
          <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {upcomingShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)}
          </CardContent>
        </Card>
      ) : null}

      {endedShifts.length ? (
        <Card>
          <CardHeader><CardTitle>Earlier today</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {endedShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function FloorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><CphiaLoader label="Loading floor…" /></div>}>
      <FloorPageInner />
    </Suspense>
  );
}
