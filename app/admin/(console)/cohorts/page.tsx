'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { COHORT_STATUSES } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';

type Cohort = {
  id: string;
  name: string;
  code: string;
  venue: string;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  capacity: number;
  volunteers: number;
  shifts: number;
};

const empty = { name: '', code: '', venue: '', startsOn: '', endsOn: '', description: '', status: 'planning', capacity: '0' };

export default function CohortsPage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const payload = await adminFetch<{ cohorts: Cohort[] }>('/api/admin/cohorts');
    setCohorts(payload.cohorts);
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  async function createCohort() {
    try {
      const payload = await adminFetch<{ id: string }>('/api/admin/cohorts', { method: 'POST', body: JSON.stringify({ ...form, capacity: Number(form.capacity) || 0 }) });
      toast.success('Cohort created.');
      router.push(href(`/admin/cohorts/${payload.id}`));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not create the cohort.');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader kicker="EVENTS" title="Events and cohorts" description="A cohort is one volunteer group for an event: code, venue, dates, capacity, and the shifts under it." />
      <Banner message={error} />
      <Card>
        <CardHeader><CardTitle>New cohort</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Name"><input className={controlClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Code"><input className={controlClass} value={form.code} placeholder="CPHIA-26" onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="Venue"><input className={controlClass} value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></Field>
          <Field label="Starts"><input className={controlClass} type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></Field>
          <Field label="Ends"><input className={controlClass} type="date" value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></Field>
          <Field label="Capacity"><input className={controlClass} type="number" min={0} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field>
          <Field label="Status">
            <select className={controlClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {COHORT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Detail"><textarea className={`${controlClass} min-h-24 py-3`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          </div>
          <Button className="h-11 w-fit" onClick={() => void createCohort()}>Create and open</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {cohorts.map((cohort) => (
          <Link key={cohort.id} href={href(`/admin/cohorts/${cohort.id}`)}>
            <Card className="h-full transition hover:ring-[#e7c15a]/40">
              <CardHeader>
                <CardTitle>{cohort.name}</CardTitle>
                <p className="text-xs uppercase tracking-[0.14em] text-[#e7c15a]">{cohort.code} · {cohort.status}</p>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm text-zinc-400">
                <p>{cohort.venue || 'Venue not set'}</p>
                <p>{cohort.starts_on || 'Start open'} → {cohort.ends_on || 'End open'}</p>
                <p>{cohort.volunteers} volunteers · {cohort.shifts} shifts · capacity {cohort.capacity || 'open'}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
