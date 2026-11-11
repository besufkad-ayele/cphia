'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
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
  cohort: { id: string; name: string; code: string } | null;
  team: { id: string; name: string; code: string } | null;
};

type FloorPayload = {
  date: string;
  totals: { present: number; late: number; absent: number; excused: number; gap: number; shifts: number; people?: number };
  shifts: FloorShift[];
  teams: TeamRollup[];
  cohorts: Cohort[];
};

export default function FloorPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cohortId, setCohortId] = useState('');
  const [data, setData] = useState<FloorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(nextDate = date, nextCohort = cohortId) {
    const params = new URLSearchParams({ date: nextDate });
    if (nextCohort) params.set('cohortId', nextCohort);
    setData(await adminFetch<FloorPayload>(`/api/admin/floor?${params}`));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [date, cohortId]);

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="LIVE"
        title="Live floor"
        description="Unique people for the day (morning or afternoon counts once), plus per-shift and floor-team counts. Refreshes every 30 seconds."
      />
      <Banner message={error} />
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button type="button" className={cn(buttonVariants({ variant: 'outline' }), 'h-11 w-full sm:w-auto')} onClick={() => void load()}>
              Refresh now
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Card><CardHeader><CardTitle className="text-2xl sm:text-3xl">{data?.totals.shifts ?? 0}</CardTitle><p className="text-sm text-zinc-400">Shifts today</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl text-emerald-300 sm:text-3xl">{data?.totals.present ?? 0}</CardTitle><p className="text-sm text-zinc-400">Present (people)</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl text-[#e7c15a] sm:text-3xl">{data?.totals.late ?? 0}</CardTitle><p className="text-sm text-zinc-400">Late (people)</p></CardHeader></Card>
        <Card><CardHeader><CardTitle className="text-2xl text-zinc-200 sm:text-3xl">{data?.totals.absent ?? 0}</CardTitle><p className="text-sm text-zinc-400">Absent (people)</p></CardHeader></Card>
        <Card className="col-span-2 xl:col-span-1"><CardHeader><CardTitle className="text-2xl text-rose-300 sm:text-3xl">{data?.totals.gap ?? 0}</CardTitle><p className="text-sm text-zinc-400">Capacity gap</p></CardHeader></Card>
      </div>

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
        <CardHeader><CardTitle>Shifts on {date}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(data?.shifts ?? []).map((shift) => (
            <div key={shift.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-white">{shift.name}</p>
                <p className="text-sm text-zinc-400">
                  {shift.start}–{shift.end}
                  {shift.team ? ` · ${shift.team.name}` : ' · training'}
                  {shift.cohort ? ` · ${shift.cohort.code}` : ''}
                  {' · '}{shift.sheetStatus}
                  {shift.location ? ` · ${shift.location}` : ''}
                </p>
                <p className="text-xs text-zinc-500">
                  present {shift.present} · late {shift.late} · absent {shift.absent} · excused {shift.excused}
                  {shift.capacity > 0 ? ` · capacity ${shift.capacity} · gap ${shift.gap}` : ''}
                  {' · '}marked {shift.totalMarked}
                </p>
              </div>
              <Link href={href(`/admin/attendance?shiftId=${shift.id}`)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full sm:w-fit')}>
                Open sheet
              </Link>
            </div>
          ))}
          {(data?.shifts.length ?? 0) === 0 ? <p className="text-sm text-zinc-400 sm:col-span-2">No shifts on this date.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
