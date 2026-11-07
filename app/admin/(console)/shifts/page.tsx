'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SHIFT_KINDS } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Cohort = { id: string; name: string; code: string };
type Team = { id: string; name: string; code: string; cohort_id: string; status: string };
type Shift = {
  id: string;
  cohort_id: string;
  name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  location: string;
  sector: string;
  capacity: number;
  notes: string;
  kind: string;
  team_id: string | null;
  sheet_status: string;
  marked: number;
  ops_cohorts: { name: string; code: string } | { name: string; code: string }[] | null;
  ops_teams: { name: string; code: string } | { name: string; code: string }[] | null;
};

const empty = {
  cohortId: '',
  name: '',
  date: '',
  startTime: '08:00',
  endTime: '12:00',
  location: '',
  sector: '',
  capacity: '0',
  notes: '',
  kind: 'training',
  teamId: '',
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const payload = await adminFetch<{ shifts: Shift[]; cohorts: Cohort[]; teams: Team[] }>('/api/admin/shifts');
    setShifts(payload.shifts);
    setCohorts(payload.cohorts);
    setTeams(payload.teams ?? []);
    setForm((current) => ({ ...current, cohortId: current.cohortId || payload.cohorts[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  const teamsForCohort = useMemo(
    () => teams.filter((team) => team.cohort_id === form.cohortId),
    [teams, form.cohortId],
  );

  async function save() {
    try {
      const body = {
        ...form,
        capacity: Number(form.capacity) || 0,
        teamId: form.kind === 'ops' ? form.teamId || null : null,
      };
      if (editing) await adminFetch(`/api/admin/shifts/${editing}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await adminFetch('/api/admin/shifts', { method: 'POST', body: JSON.stringify(body) });
      toast.success(editing ? 'Shift updated.' : 'Shift added.');
      setEditing(null);
      setForm({ ...empty, cohortId: cohorts[0]?.id || '' });
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the shift.');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this shift and its attendance marks?')) return;
    try {
      await adminFetch(`/api/admin/shifts/${id}`, { method: 'DELETE' });
      toast.success('Shift deleted.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the shift.');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="ROSTER"
        title="Shifts"
        description="Training shifts cover everyone. Ops shifts hang on a floor team so that supervisor’s sheet stays separate."
      />
      <Banner message={error} />
      <Card>
        <CardHeader><CardTitle>{editing ? 'Edit shift' : 'Add a shift'}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Event / cohort">
            <select className={controlClass} value={form.cohortId} onChange={(event) => setForm({ ...form, cohortId: event.target.value, teamId: '' })}>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>)}
            </select>
          </Field>
          <Field label="Kind">
            <select className={controlClass} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, teamId: event.target.value === 'ops' ? form.teamId : '' })}>
              {SHIFT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </Field>
          {form.kind === 'ops' ? (
            <Field label="Floor team">
              <select className={controlClass} value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}>
                <option value="">Select team</option>
                {teamsForCohort.map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` · ${team.code}` : ''}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Sector (optional)"><input className={controlClass} value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} /></Field>
          )}
          <Field label="Name"><input className={controlClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Date"><input className={controlClass} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
          <Field label="Starts"><input className={controlClass} type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
          <Field label="Ends"><input className={controlClass} type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></Field>
          <Field label="Location"><input className={controlClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
          <Field label="Capacity"><input className={controlClass} type="number" min={0} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field>
          {form.kind === 'ops' ? (
            <Field label="Sector (optional)"><input className={controlClass} value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} /></Field>
          ) : null}
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Notes"><input className={controlClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          </div>
          <div className="flex gap-2">
            <Button className="h-11" onClick={() => void save()}>{editing ? 'Save shift' : 'Add shift'}</Button>
            {editing ? <Button variant="outline" className="h-11" onClick={() => { setEditing(null); setForm({ ...empty, cohortId: cohorts[0]?.id || '' }); }}>Cancel</Button> : null}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {shifts.map((shift) => {
          const cohort = Array.isArray(shift.ops_cohorts) ? shift.ops_cohorts[0] : shift.ops_cohorts;
          const team = Array.isArray(shift.ops_teams) ? shift.ops_teams[0] : shift.ops_teams;
          return (
            <Card key={shift.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div>
                  <p className="font-medium text-white">{shift.name}</p>
                  <p className="text-sm text-zinc-400">
                    {cohort?.code || 'Cohort'} · {shift.kind}{team ? ` · ${team.name}` : ''} · {shift.shift_date} · {String(shift.start_time).slice(0, 5)}–{String(shift.end_time).slice(0, 5)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {shift.location || 'No location'} · {shift.sector || 'Any sector'} · {shift.marked} marked · capacity {shift.capacity || 'open'} · sheet {shift.sheet_status || 'open'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditing(shift.id);
                    setForm({
                      cohortId: shift.cohort_id,
                      name: shift.name,
                      date: shift.shift_date,
                      startTime: String(shift.start_time).slice(0, 5),
                      endTime: String(shift.end_time).slice(0, 5),
                      location: shift.location,
                      sector: shift.sector,
                      capacity: String(shift.capacity),
                      notes: shift.notes,
                      kind: shift.kind || 'training',
                      teamId: shift.team_id || '',
                    });
                  }}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(shift.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {shifts.length === 0 ? <p className="text-sm text-zinc-400">No shifts yet. Add a training or ops duty block above.</p> : null}
      </div>
    </div>
  );
}
