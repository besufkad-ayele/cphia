'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { COHORT_STATUSES } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type Shift = { id: string; name: string; shift_date: string; start_time: string; end_time: string; location: string; sector: string; capacity: number };
type Detail = {
  cohort: {
    id: string;
    name: string;
    code: string;
    venue: string;
    starts_on: string | null;
    ends_on: string | null;
    description: string;
    status: string;
    capacity: number;
  };
  volunteers: number;
  shifts: Shift[];
};

export default function CohortDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setDetail(await adminFetch<Detail>(`/api/admin/cohorts/${params.id}`));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, [params.id]);

  async function save() {
    if (!detail) return;
    const cohort = detail.cohort;
    try {
      await adminFetch(`/api/admin/cohorts/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: cohort.name,
          code: cohort.code,
          venue: cohort.venue,
          startsOn: cohort.starts_on || '',
          endsOn: cohort.ends_on || '',
          description: cohort.description,
          status: cohort.status,
          capacity: cohort.capacity,
        }),
      });
      toast.success('Cohort saved.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the cohort.');
    }
  }

  async function remove() {
    if (!window.confirm('Delete this cohort and its shifts?')) return;
    try {
      await adminFetch(`/api/admin/cohorts/${params.id}`, { method: 'DELETE' });
      router.push(href('/admin/cohorts'));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the cohort.');
    }
  }

  function patch(partial: Partial<Detail['cohort']>) {
    setDetail((current) => current ? { ...current, cohort: { ...current.cohort, ...partial } } : current);
  }

  const cohort = detail?.cohort;

  return (
    <div className="grid gap-6">
      <PageHeader kicker="COHORT DETAIL" title={cohort?.name || 'Cohort'} description="Venue, dates, capacity, the volunteer count on this code, and every shift under it.">
        <Link href={href('/admin/shifts')} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>Add a shift</Link>
      </PageHeader>
      <Banner message={error} />
      {cohort ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-3xl">{detail?.volunteers ?? 0}</CardTitle><p className="text-sm text-zinc-400">Volunteers on {cohort.code}</p></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-3xl">{detail?.shifts.length ?? 0}</CardTitle><p className="text-sm text-zinc-400">Shifts on this cohort</p></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-3xl">{cohort.capacity || '—'}</CardTitle><p className="text-sm text-zinc-400">Capacity</p></CardHeader></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Event record</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Name"><input className={controlClass} value={cohort.name} onChange={(event) => patch({ name: event.target.value })} /></Field>
              <Field label="Code"><input className={controlClass} value={cohort.code} onChange={(event) => patch({ code: event.target.value })} /></Field>
              <Field label="Venue"><input className={controlClass} value={cohort.venue} onChange={(event) => patch({ venue: event.target.value })} /></Field>
              <Field label="Status">
                <select className={controlClass} value={cohort.status} onChange={(event) => patch({ status: event.target.value })}>
                  {COHORT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Starts"><input className={controlClass} type="date" value={cohort.starts_on || ''} onChange={(event) => patch({ starts_on: event.target.value })} /></Field>
              <Field label="Ends"><input className={controlClass} type="date" value={cohort.ends_on || ''} onChange={(event) => patch({ ends_on: event.target.value })} /></Field>
              <Field label="Capacity"><input className={controlClass} type="number" min={0} value={cohort.capacity} onChange={(event) => patch({ capacity: Number(event.target.value) || 0 })} /></Field>
              <div className="md:col-span-2">
                <Field label="Detail"><textarea className={`${controlClass} min-h-28 py-3`} value={cohort.description} onChange={(event) => patch({ description: event.target.value })} /></Field>
              </div>
              <div className="flex gap-2">
                <Button className="h-11" onClick={() => void save()}>Save cohort</Button>
                <Button variant="ghost" className="h-11" onClick={() => void remove()}>Delete</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Shifts in this cohort</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {(detail?.shifts ?? []).map((shift) => (
                <div key={shift.id} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
                  <p className="font-medium text-white">{shift.name}</p>
                  <p className="text-zinc-400">{shift.shift_date} · {String(shift.start_time).slice(0, 5)}–{String(shift.end_time).slice(0, 5)} · {shift.location || 'No location'} · {shift.sector || 'Any sector'} · capacity {shift.capacity || 'open'}</p>
                </div>
              ))}
              {(detail?.shifts.length ?? 0) === 0 ? <p className="text-sm text-zinc-400">No shifts yet.</p> : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
