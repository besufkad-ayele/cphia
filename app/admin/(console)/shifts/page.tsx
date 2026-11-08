'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { eachDateInclusive, periodLabel } from '@/app/lib/admin/attendance-columns';
import { SHIFT_KINDS } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

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

type PeriodKey = 'morning' | 'afternoon';
type BulkSlot = { date: string; period: PeriodKey };

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

const emptyBulk = {
  cohortId: '',
  kind: 'training',
  teamId: '',
  blockName: '',
  startDate: '',
  endDate: '',
  location: '',
  sector: '',
  capacity: '0',
  notes: '',
  morning: true,
  afternoon: true,
  morningStart: '08:00',
  morningEnd: '12:00',
  afternoonStart: '13:00',
  afternoonEnd: '17:00',
};

function slotKey(slot: BulkSlot) {
  return `${slot.date}:${slot.period}`;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scoped, setScoped] = useState(false);
  const [form, setForm] = useState(empty);
  const [bulk, setBulk] = useState(emptyBulk);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const payload = await adminFetch<{ shifts: Shift[]; cohorts: Cohort[]; teams: Team[]; scoped?: boolean }>('/api/admin/shifts');
    setShifts(payload.shifts);
    setCohorts(payload.cohorts);
    setTeams(payload.teams ?? []);
    setScoped(Boolean(payload.scoped));
    const defaultCohort = payload.cohorts[0]?.id || payload.teams?.[0]?.cohort_id || '';
    const defaultTeam = payload.teams?.[0]?.id || '';
    setForm((current) => ({
      ...current,
      cohortId: current.cohortId || defaultCohort,
      kind: payload.scoped ? 'ops' : current.kind,
      teamId: current.teamId || (payload.scoped ? defaultTeam : ''),
    }));
    setBulk((current) => ({
      ...current,
      cohortId: current.cohortId || defaultCohort,
      kind: payload.scoped ? 'ops' : current.kind,
      teamId: current.teamId || (payload.scoped ? defaultTeam : ''),
    }));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  const teamsForCohort = useMemo(
    () => teams.filter((team) => !form.cohortId || team.cohort_id === form.cohortId),
    [teams, form.cohortId],
  );
  const bulkTeams = useMemo(
    () => teams.filter((team) => !bulk.cohortId || team.cohort_id === bulk.cohortId),
    [teams, bulk.cohortId],
  );

  const candidateSlots = useMemo(() => {
    const periods: PeriodKey[] = [
      ...(bulk.morning ? (['morning'] as const) : []),
      ...(bulk.afternoon ? (['afternoon'] as const) : []),
    ];
    if (!periods.length || !bulk.startDate || !bulk.endDate) return [] as BulkSlot[];
    return eachDateInclusive(bulk.startDate, bulk.endDate).flatMap((date) =>
      periods.map((period) => ({ date, period })),
    );
  }, [bulk.startDate, bulk.endDate, bulk.morning, bulk.afternoon]);

  // When the block window changes, select every candidate by default so users only uncheck what they don't need.
  useEffect(() => {
    setSelectedSlots(candidateSlots.map(slotKey));
  }, [candidateSlots]);

  const selectedCount = selectedSlots.length;

  function toggleSlot(key: string) {
    setSelectedSlots((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function selectAllSlots() {
    setSelectedSlots(candidateSlots.map(slotKey));
  }

  function clearSlots() {
    setSelectedSlots([]);
  }

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
      setForm({ ...empty, cohortId: cohorts[0]?.id || teams[0]?.cohort_id || '', kind: scoped ? 'ops' : 'training', teamId: scoped ? teams[0]?.id || '' : '' });
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the shift.');
    }
  }

  async function saveBulk() {
    if (!bulk.morning && !bulk.afternoon) {
      toast.error('Enable morning, afternoon, or both for this block.');
      return;
    }
    if (!candidateSlots.length) {
      toast.error('Set a valid from / to date for the block.');
      return;
    }
    const slots = candidateSlots.filter((slot) => selectedSlots.includes(slotKey(slot)));
    if (!slots.length) {
      toast.error('Select at least one individual shift in the block.');
      return;
    }
    try {
      const team = teams.find((row) => row.id === bulk.teamId);
      const payload = await adminFetch<{ created: number }>('/api/admin/shifts', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'bulk',
          cohortId: bulk.cohortId || team?.cohort_id || '',
          kind: bulk.kind,
          teamId: bulk.kind === 'ops' ? bulk.teamId || null : null,
          blockName: bulk.blockName,
          startDate: bulk.startDate,
          endDate: bulk.endDate,
          location: bulk.location,
          sector: bulk.sector,
          capacity: Number(bulk.capacity) || 0,
          notes: bulk.notes,
          slots,
          morningStart: bulk.morningStart,
          morningEnd: bulk.morningEnd,
          afternoonStart: bulk.afternoonStart,
          afternoonEnd: bulk.afternoonEnd,
        }),
      });
      toast.success(`Created 1 block with ${payload.created} selected shifts.`);
      setSelectedSlots([]);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not create the shift block.');
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
        description="Create one bulk block, then tick only the morning / afternoon shifts you need. Training covers everyone; ops shifts hang on a floor team."
      />
      <Banner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>1 · Create one bulk block</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {!scoped ? (
            <Field label="Event / cohort">
              <select className={controlClass} value={bulk.cohortId} onChange={(event) => setBulk({ ...bulk, cohortId: event.target.value, teamId: '' })}>
                {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Kind">
            <select
              className={controlClass}
              value={bulk.kind}
              disabled={scoped}
              onChange={(event) => setBulk({ ...bulk, kind: event.target.value, teamId: event.target.value === 'ops' ? bulk.teamId : '' })}
            >
              {SHIFT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </Field>
          {bulk.kind === 'ops' ? (
            <Field label="Floor team">
              <select className={controlClass} value={bulk.teamId} onChange={(event) => setBulk({ ...bulk, teamId: event.target.value })}>
                <option value="">Select team</option>
                {bulkTeams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` · ${team.code}` : ''}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Sector (optional)"><input className={controlClass} value={bulk.sector} onChange={(event) => setBulk({ ...bulk, sector: event.target.value })} /></Field>
          )}
          <Field label="Block name (optional)">
            <input
              className={controlClass}
              value={bulk.blockName}
              placeholder="e.g. Training week 1 · AM/PM"
              onChange={(event) => setBulk({ ...bulk, blockName: event.target.value })}
            />
          </Field>
          <Field label="From date"><input className={controlClass} type="date" value={bulk.startDate} onChange={(event) => setBulk({ ...bulk, startDate: event.target.value })} /></Field>
          <Field label="To date"><input className={controlClass} type="date" value={bulk.endDate} onChange={(event) => setBulk({ ...bulk, endDate: event.target.value })} /></Field>
          <Field label="Location"><input className={controlClass} value={bulk.location} onChange={(event) => setBulk({ ...bulk, location: event.target.value })} /></Field>
          <Field label="Capacity"><input className={controlClass} type="number" min={0} value={bulk.capacity} onChange={(event) => setBulk({ ...bulk, capacity: event.target.value })} /></Field>
          <div className="md:col-span-2 xl:col-span-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
              <input type="checkbox" checked={bulk.morning} onChange={(event) => setBulk({ ...bulk, morning: event.target.checked })} />
              Offer morning · {bulk.morningStart}–{bulk.morningEnd}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
              <input type="checkbox" checked={bulk.afternoon} onChange={(event) => setBulk({ ...bulk, afternoon: event.target.checked })} />
              Offer afternoon · {bulk.afternoonStart}–{bulk.afternoonEnd}
            </label>
          </div>
          {bulk.morning ? (
            <>
              <Field label="Morning starts"><input className={controlClass} type="time" value={bulk.morningStart} onChange={(event) => setBulk({ ...bulk, morningStart: event.target.value })} /></Field>
              <Field label="Morning ends"><input className={controlClass} type="time" value={bulk.morningEnd} onChange={(event) => setBulk({ ...bulk, morningEnd: event.target.value })} /></Field>
            </>
          ) : null}
          {bulk.afternoon ? (
            <>
              <Field label="Afternoon starts"><input className={controlClass} type="time" value={bulk.afternoonStart} onChange={(event) => setBulk({ ...bulk, afternoonStart: event.target.value })} /></Field>
              <Field label="Afternoon ends"><input className={controlClass} type="time" value={bulk.afternoonEnd} onChange={(event) => setBulk({ ...bulk, afternoonEnd: event.target.value })} /></Field>
            </>
          ) : null}
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Notes (applied to every selected shift)"><input className={controlClass} value={bulk.notes} onChange={(event) => setBulk({ ...bulk, notes: event.target.value })} /></Field>
          </div>

          <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">2 · Select individual shifts</p>
                <p className="text-xs text-zinc-400">
                  One block will be created. Tick only the day · period shifts you need
                  {candidateSlots.length ? ` · ${selectedCount} of ${candidateSlots.length} selected` : ''}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!candidateSlots.length} onClick={selectAllSlots}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={!selectedCount} onClick={clearSlots}>
                  Clear
                </Button>
              </div>
            </div>

            {!candidateSlots.length ? (
              <p className="mt-4 text-sm text-zinc-500">
                Choose from / to dates and enable morning and/or afternoon to list selectable shifts.
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {candidateSlots.map((slot) => {
                  const key = slotKey(slot);
                  const checked = selectedSlots.includes(key);
                  const time =
                    slot.period === 'morning'
                      ? `${bulk.morningStart}–${bulk.morningEnd}`
                      : `${bulk.afternoonStart}–${bulk.afternoonEnd}`;
                  return (
                    <label
                      key={key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition',
                        checked
                          ? 'border-[#e7c15a]/45 bg-[#e7c15a]/10 text-white'
                          : 'border-white/10 bg-black/25 text-zinc-300 hover:border-white/20',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleSlot(key)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{periodLabel(slot.period)} · {slot.date}</span>
                        <span className="block text-xs text-zinc-400">{time}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <Button className="h-11" disabled={!selectedCount} onClick={() => void saveBulk()}>
              Create block with {selectedCount || 0} selected shift{selectedCount === 1 ? '' : 's'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{editing ? 'Edit shift' : 'Add a single shift'}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {!scoped ? (
            <Field label="Event / cohort">
              <select className={controlClass} value={form.cohortId} onChange={(event) => setForm({ ...form, cohortId: event.target.value, teamId: '' })}>
                {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Kind">
            <select className={controlClass} value={form.kind} disabled={scoped} onChange={(event) => setForm({ ...form, kind: event.target.value, teamId: event.target.value === 'ops' ? form.teamId : '' })}>
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
            {editing ? <Button variant="outline" className="h-11" onClick={() => { setEditing(null); setForm({ ...empty, cohortId: cohorts[0]?.id || teams[0]?.cohort_id || '', kind: scoped ? 'ops' : 'training', teamId: scoped ? teams[0]?.id || '' : '' }); }}>Cancel</Button> : null}
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
                <div className="flex flex-wrap gap-2">
                  <Link href={href(`/admin/attendance?shiftId=${shift.id}`)} className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
                    Open sheet
                  </Link>
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
