'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { eachDateInclusive, periodLabel } from '@/app/lib/admin/attendance-columns';
import { adminFetch } from '@/app/lib/admin/messages';
import { SHIFT_KINDS } from '@/app/lib/admin/ops';
import { hasCapability } from '@/app/lib/admin/permissions';
import { sectorChecklistOptions } from '@/app/lib/admin/shift-sectors';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type AdminSession = { role: string; permissions: string[] };

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
  sectors: string[];
  capacity: number;
  notes: string;
  kind: string;
  team_id: string | null;
  block_id: string | null;
  sheet_status: string;
  is_floor_default?: boolean;
  marked: number;
  ops_cohorts: { name: string; code: string } | { name: string; code: string }[] | null;
  ops_teams: { name: string; code: string } | { name: string; code: string }[] | null;
};
type Block = {
  id: string;
  cohort_id: string;
  team_id: string | null;
  kind: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  capacity: number;
  notes: string;
  is_floor_default?: boolean;
};

type PeriodKey = 'morning' | 'afternoon';
type BulkSlot = { date: string; period: PeriodKey };

const SECTOR_OPTIONS = sectorChecklistOptions();

const empty = {
  cohortId: '',
  name: '',
  date: '',
  startTime: '08:00',
  endTime: '12:00',
  location: '',
  sectors: [] as string[],
  capacity: '0',
  notes: '',
  kind: 'training',
  teamId: '',
  blockId: '',
};

const emptyBulk = {
  cohortId: '',
  kind: 'training',
  teamId: '',
  blockName: '',
  startDate: '',
  endDate: '',
  location: '',
  sectors: [] as string[],
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

function sectorsLabel(sectors: string[] | undefined, fallback?: string) {
  if (sectors?.length) return sectors.join(', ');
  return fallback || 'Any sector';
}

function SectorChecklist({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {SECTOR_OPTIONS.map((sector) => {
        const checked = value.includes(sector);
        return (
          <label
            key={sector}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
              checked
                ? 'border-[#e7c15a]/45 bg-[#e7c15a]/10 text-white'
                : 'border-white/10 bg-black/25 text-zinc-300 hover:border-white/20',
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                onChange(
                  checked ? value.filter((item) => item !== sector) : [...value, sector],
                );
              }}
            />
            {sector}
          </label>
        );
      })}
    </div>
  );
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scoped, setScoped] = useState(false);
  const [form, setForm] = useState(empty);
  const [bulk, setBulk] = useState(emptyBulk);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [appendBlockId, setAppendBlockId] = useState<string | null>(null);
  const [append, setAppend] = useState({
    startDate: '',
    endDate: '',
    morning: true,
    afternoon: true,
    morningStart: '08:00',
    morningEnd: '12:00',
    afternoonStart: '13:00',
    afternoonEnd: '17:00',
    sectors: [] as string[],
    location: '',
    capacity: '0',
    notes: '',
  });
  const [appendSlots, setAppendSlots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);

  const canCreate = session ? hasCapability(session, 'shifts.create') : false;
  const canEdit = session ? hasCapability(session, 'shifts.edit') : false;
  const canDelete = session ? hasCapability(session, 'shifts.delete') : false;

  useEffect(() => {
    fetch('/api/admin/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload) return;
        setSession({
          role: payload.role || 'admin',
          permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
        });
      })
      .catch(() => null);
  }, []);

  async function load() {
    const payload = await adminFetch<{
      shifts: Shift[];
      blocks: Block[];
      cohorts: Cohort[];
      teams: Team[];
      scoped?: boolean;
    }>('/api/admin/shifts');
    setShifts(payload.shifts);
    setBlocks(payload.blocks ?? []);
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

  useEffect(() => {
    setSelectedSlots(candidateSlots.map(slotKey));
  }, [candidateSlots]);

  const appendCandidates = useMemo(() => {
    const periods: PeriodKey[] = [
      ...(append.morning ? (['morning'] as const) : []),
      ...(append.afternoon ? (['afternoon'] as const) : []),
    ];
    if (!periods.length || !append.startDate || !append.endDate) return [] as BulkSlot[];
    return eachDateInclusive(append.startDate, append.endDate).flatMap((date) =>
      periods.map((period) => ({ date, period })),
    );
  }, [append.startDate, append.endDate, append.morning, append.afternoon]);

  useEffect(() => {
    setAppendSlots(appendCandidates.map(slotKey));
  }, [appendCandidates]);

  const selectedCount = selectedSlots.length;
  const appendCount = appendSlots.length;

  const grouped = useMemo(() => {
    const byBlock = new Map<string, Shift[]>();
    const ungrouped: Shift[] = [];
    for (const shift of shifts) {
      if (shift.block_id) {
        const list = byBlock.get(shift.block_id) ?? [];
        list.push(shift);
        byBlock.set(shift.block_id, list);
      } else {
        ungrouped.push(shift);
      }
    }
    const blockSections = blocks.map((block) => ({
      block,
      shifts: byBlock.get(block.id) ?? [],
    }));
    const orphanBlockIds = [...byBlock.keys()].filter((id) => !blocks.some((block) => block.id === id));
    for (const id of orphanBlockIds) {
      blockSections.push({
        block: {
          id,
          cohort_id: '',
          team_id: null,
          kind: 'training',
          name: 'Untitled block',
          start_date: '',
          end_date: '',
          location: '',
          capacity: 0,
          notes: '',
        },
        shifts: byBlock.get(id) ?? [],
      });
    }
    return { blockSections, ungrouped };
  }, [blocks, shifts]);

  function toggleSlot(key: string) {
    setSelectedSlots((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function toggleAppendSlot(key: string) {
    setAppendSlots((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function save() {
    try {
      const body = {
        ...form,
        capacity: Number(form.capacity) || 0,
        teamId: form.kind === 'ops' ? form.teamId || null : null,
        sectors: form.sectors,
        blockId: form.blockId || null,
      };
      if (editing) await adminFetch(`/api/admin/shifts/${editing}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await adminFetch('/api/admin/shifts', { method: 'POST', body: JSON.stringify(body) });
      toast.success(editing ? 'Shift updated.' : 'Shift added.');
      setEditing(null);
      setForm({
        ...empty,
        cohortId: cohorts[0]?.id || teams[0]?.cohort_id || '',
        kind: scoped ? 'ops' : 'training',
        teamId: scoped ? teams[0]?.id || '' : '',
      });
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
          sectors: bulk.sectors,
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
      resetBulkForm({
        cohortId: bulk.cohortId,
        kind: bulk.kind,
        teamId: bulk.kind === 'ops' ? bulk.teamId : '',
      });
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not create the shift block.');
    }
  }

  function resetBulkForm(overrides?: Partial<typeof emptyBulk>) {
    setBulk({
      ...emptyBulk,
      cohortId: cohorts[0]?.id || teams[0]?.cohort_id || '',
      kind: scoped ? 'ops' : 'training',
      teamId: scoped ? teams[0]?.id || '' : '',
      ...overrides,
    });
    setSelectedSlots([]);
    setEditingBlockId(null);
  }

  async function saveBlockEdit() {
    if (!editingBlockId) return;
    if (!bulk.blockName.trim()) {
      toast.error('Block name is required.');
      return;
    }
    if (!bulk.startDate || !bulk.endDate) {
      toast.error('Set both from and to dates for this bulk.');
      return;
    }
    if (bulk.endDate < bulk.startDate) {
      toast.error('To date must be on or after from date.');
      return;
    }
    try {
      const payload = await adminFetch<{ ok: boolean; added?: number; removed?: number }>(
        `/api/admin/shifts/blocks/${editingBlockId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: bulk.blockName,
            location: bulk.location,
            capacity: Number(bulk.capacity) || 0,
            notes: bulk.notes,
            startDate: bulk.startDate,
            endDate: bulk.endDate,
            sectors: bulk.sectors,
            applyToShifts: true,
            syncShifts: true,
          }),
        },
      );
      const added = payload.added ?? 0;
      const removed = payload.removed ?? 0;
      toast.success(
        added || removed
          ? `Bulk updated · added ${added} · removed ${removed} shift${added + removed === 1 ? '' : 's'}.`
          : 'Bulk block updated.',
      );
      resetBulkForm();
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not update the block.');
    }
  }

  async function saveAppend() {
    if (!appendBlockId) return;
    const slots = appendCandidates.filter((slot) => appendSlots.includes(slotKey(slot)));
    if (!slots.length) {
      toast.error('Select at least one shift to add.');
      return;
    }
    try {
      const payload = await adminFetch<{ created: number }>('/api/admin/shifts', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'append',
          blockId: appendBlockId,
          slots,
          sectors: append.sectors,
          location: append.location,
          capacity: Number(append.capacity) || 0,
          notes: append.notes,
          morningStart: append.morningStart,
          morningEnd: append.morningEnd,
          afternoonStart: append.afternoonStart,
          afternoonEnd: append.afternoonEnd,
        }),
      });
      toast.success(`Added ${payload.created} shift${payload.created === 1 ? '' : 's'} to the bulk block.`);
      setAppendBlockId(null);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not add shifts to the block.');
    }
  }

  async function remove(id: string) {
    if (!canDelete) {
      toast.error('Your role cannot delete shifts.');
      return;
    }
    if (!window.confirm('Delete this shift and its attendance marks?')) return;
    try {
      await adminFetch(`/api/admin/shifts/${id}`, { method: 'DELETE' });
      toast.success('Shift deleted.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the shift.');
    }
  }

  async function removeBlock(id: string, mode: 'with_shifts' | 'ungroup' = 'with_shifts') {
    if (!canDelete) {
      toast.error('Your role cannot delete bulk blocks.');
      return;
    }
    const message = mode === 'with_shifts'
      ? 'Delete this bulk block and every shift inside it (including attendance marks)?'
      : 'Delete this bulk block shell only? Shifts inside stay as ungrouped singles.';
    if (!window.confirm(message)) return;
    try {
      const payload = await adminFetch<{ deletedShifts?: number }>(
        `/api/admin/shifts/blocks/${id}?mode=${mode}`,
        { method: 'DELETE' },
      );
      toast.success(
        mode === 'with_shifts'
          ? `Bulk block deleted${payload.deletedShifts ? ` with ${payload.deletedShifts} shifts` : ''}.`
          : 'Bulk block removed; shifts kept ungrouped.',
      );
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the block.');
    }
  }

  function startEditShift(shift: Shift) {
    setEditing(shift.id);
    setForm({
      cohortId: shift.cohort_id,
      name: shift.name,
      date: shift.shift_date,
      startTime: String(shift.start_time).slice(0, 5),
      endTime: String(shift.end_time).slice(0, 5),
      location: shift.location,
      sectors: shift.sectors?.length
        ? shift.sectors
        : shift.sector
          ? shift.sector.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      capacity: String(shift.capacity),
      notes: shift.notes,
      kind: shift.kind || 'training',
      teamId: shift.team_id || '',
      blockId: shift.block_id || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEditBlock(block: Block) {
    const blockShifts = shifts.filter((shift) => shift.block_id === block.id);
    const sectorSet = new Set<string>();
    for (const shift of blockShifts) {
      if (shift.sectors?.length) {
        for (const sector of shift.sectors) sectorSet.add(sector);
      } else if (shift.sector) {
        for (const part of shift.sector.split(',')) {
          const trimmed = part.trim();
          if (trimmed) sectorSet.add(trimmed);
        }
      }
    }

    let morning = false;
    let afternoon = false;
    let morningStart = emptyBulk.morningStart;
    let morningEnd = emptyBulk.morningEnd;
    let afternoonStart = emptyBulk.afternoonStart;
    let afternoonEnd = emptyBulk.afternoonEnd;
    for (const shift of blockShifts) {
      const start = String(shift.start_time).slice(0, 5);
      const end = String(shift.end_time).slice(0, 5);
      if (start < '12:00') {
        morning = true;
        morningStart = start;
        morningEnd = end;
      } else {
        afternoon = true;
        afternoonStart = start;
        afternoonEnd = end;
      }
    }

    setAppendBlockId(null);
    setEditing(null);
    setEditingBlockId(block.id);
    setBulk({
      cohortId: block.cohort_id || cohorts[0]?.id || '',
      kind: block.kind || 'training',
      teamId: block.team_id || '',
      blockName: block.name,
      startDate: block.start_date || '',
      endDate: block.end_date || '',
      location: block.location || '',
      sectors: [...sectorSet],
      capacity: String(block.capacity ?? 0),
      notes: block.notes || '',
      morning: morning || (!morning && !afternoon),
      afternoon,
      morningStart,
      morningEnd,
      afternoonStart,
      afternoonEnd,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelBlockEdit() {
    resetBulkForm();
  }

  function startAppend(block: Block) {
    if (editingBlockId) resetBulkForm({
      cohortId: bulk.cohortId,
      kind: bulk.kind,
      teamId: bulk.teamId,
    });
    setAppendBlockId(block.id);
    setAppend({
      startDate: block.end_date || '',
      endDate: block.end_date || '',
      morning: true,
      afternoon: true,
      morningStart: '08:00',
      morningEnd: '12:00',
      afternoonStart: '13:00',
      afternoonEnd: '17:00',
      sectors: [],
      location: block.location,
      capacity: String(block.capacity),
      notes: block.notes,
    });
  }

  function renderShiftRow(shift: Shift) {
    const cohort = Array.isArray(shift.ops_cohorts) ? shift.ops_cohorts[0] : shift.ops_cohorts;
    const team = Array.isArray(shift.ops_teams) ? shift.ops_teams[0] : shift.ops_teams;
    return (
      <div
        key={shift.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-3"
      >
        <div>
          <p className="font-medium text-white">
            {shift.is_floor_default ? '★ ' : ''}
            {shift.name}
          </p>
          <p className="text-sm text-zinc-400">
            {cohort?.code || 'Cohort'} · {shift.kind}{team ? ` · ${team.name}` : ''} · {shift.shift_date} · {String(shift.start_time).slice(0, 5)}–{String(shift.end_time).slice(0, 5)}
          </p>
          <p className="text-xs text-zinc-500">
            {shift.location || 'No location'} · {sectorsLabel(shift.sectors, shift.sector)} · {shift.marked} marked · capacity {shift.capacity || 'open'} · sheet {shift.sheet_status || 'open'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={href(`/admin/attendance?shiftId=${shift.id}`)} className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
            Open sheet
          </Link>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={() => startEditShift(shift)}>Edit</Button>
          ) : null}
          {canDelete ? (
            <Button variant="ghost" size="sm" onClick={() => void remove(shift.id)}>Delete</Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="ROSTER"
        title="Shifts"
        description="Create bulk blocks with a sector checklist, edit them as a group, and add more morning/afternoon shifts later. Training covers everyone; ops shifts hang on a floor team."
      />
      <Banner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>{editingBlockId ? 'Edit bulk block' : '1 · Create one bulk block'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {!scoped ? (
            <Field label="Event / cohort">
              <select
                className={controlClass}
                value={bulk.cohortId}
                disabled={Boolean(editingBlockId)}
                onChange={(event) => setBulk({ ...bulk, cohortId: event.target.value, teamId: '' })}
              >
                {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Kind">
            <select
              className={controlClass}
              value={bulk.kind}
              disabled={scoped || Boolean(editingBlockId)}
              onChange={(event) => setBulk({ ...bulk, kind: event.target.value, teamId: event.target.value === 'ops' ? bulk.teamId : '' })}
            >
              {SHIFT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </Field>
          {bulk.kind === 'ops' ? (
            <Field label="Floor team">
              <select
                className={controlClass}
                value={bulk.teamId}
                disabled={Boolean(editingBlockId)}
                onChange={(event) => setBulk({ ...bulk, teamId: event.target.value })}
              >
                <option value="">Select team</option>
                {bulkTeams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` · ${team.code}` : ''}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label={editingBlockId ? 'Block name' : 'Block name (optional)'}>
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
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Sectors (checklist — pick one or more)">
              <SectorChecklist value={bulk.sectors} onChange={(sectors) => setBulk({ ...bulk, sectors })} />
            </Field>
          </div>
          <div className="md:col-span-2 xl:col-span-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={bulk.morning}
                disabled={Boolean(editingBlockId)}
                onChange={(event) => setBulk({ ...bulk, morning: event.target.checked })}
              />
              Offer morning · {bulk.morningStart}–{bulk.morningEnd}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={bulk.afternoon}
                disabled={Boolean(editingBlockId)}
                onChange={(event) => setBulk({ ...bulk, afternoon: event.target.checked })}
              />
              Offer afternoon · {bulk.afternoonStart}–{bulk.afternoonEnd}
            </label>
          </div>
          {bulk.morning && !editingBlockId ? (
            <>
              <Field label="Morning starts"><input className={controlClass} type="time" value={bulk.morningStart} onChange={(event) => setBulk({ ...bulk, morningStart: event.target.value })} /></Field>
              <Field label="Morning ends"><input className={controlClass} type="time" value={bulk.morningEnd} onChange={(event) => setBulk({ ...bulk, morningEnd: event.target.value })} /></Field>
            </>
          ) : null}
          {bulk.afternoon && !editingBlockId ? (
            <>
              <Field label="Afternoon starts"><input className={controlClass} type="time" value={bulk.afternoonStart} onChange={(event) => setBulk({ ...bulk, afternoonStart: event.target.value })} /></Field>
              <Field label="Afternoon ends"><input className={controlClass} type="time" value={bulk.afternoonEnd} onChange={(event) => setBulk({ ...bulk, afternoonEnd: event.target.value })} /></Field>
            </>
          ) : null}
          <div className="md:col-span-2 xl:col-span-4">
            <Field label={editingBlockId ? 'Notes (also applied to shifts in this block)' : 'Notes (applied to every selected shift)'}>
              <input className={controlClass} value={bulk.notes} onChange={(event) => setBulk({ ...bulk, notes: event.target.value })} />
            </Field>
          </div>

          {editingBlockId ? (
            <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-[#e7c15a]/30 bg-[#e7c15a]/5 p-4">
              <p className="text-sm text-zinc-300">
                Saving updates the block and <span className="text-white">syncs its shifts to the from / to dates</span>:
                missing day · morning/afternoon slots are added; shifts outside the new range are removed
                (attendance on those removed shifts is deleted too). Location, capacity, notes, and sectors
                are pushed onto every shift that remains.
              </p>
            </div>
          ) : (
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
                  <Button type="button" variant="outline" size="sm" disabled={!candidateSlots.length} onClick={() => setSelectedSlots(candidateSlots.map(slotKey))}>
                    Select all
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={!selectedCount} onClick={() => setSelectedSlots([])}>
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
          )}

          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
            {editingBlockId ? (
              <>
                <Button className="h-11" onClick={() => void saveBlockEdit()}>
                  Save block
                </Button>
                <Button variant="outline" className="h-11" onClick={cancelBlockEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button className="h-11" disabled={!selectedCount} onClick={() => void saveBulk()}>
                Create block with {selectedCount || 0} selected shift{selectedCount === 1 ? '' : 's'}
              </Button>
            )}
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
          ) : null}
          <Field label="Bulk block (optional)">
            <select className={controlClass} value={form.blockId} onChange={(event) => setForm({ ...form, blockId: event.target.value })}>
              <option value="">Ungrouped</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>{block.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Name"><input className={controlClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Date"><input className={controlClass} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
          <Field label="Starts"><input className={controlClass} type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
          <Field label="Ends"><input className={controlClass} type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></Field>
          <Field label="Location"><input className={controlClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
          <Field label="Capacity"><input className={controlClass} type="number" min={0} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field>
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Sectors (checklist)">
              <SectorChecklist value={form.sectors} onChange={(sectors) => setForm({ ...form, sectors })} />
            </Field>
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Notes"><input className={controlClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          </div>
          <div className="flex gap-2">
            <Button className="h-11" onClick={() => void save()}>{editing ? 'Save shift' : 'Add shift'}</Button>
            {editing ? (
              <Button
                variant="outline"
                className="h-11"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    ...empty,
                    cohortId: cohorts[0]?.id || teams[0]?.cohort_id || '',
                    kind: scoped ? 'ops' : 'training',
                    teamId: scoped ? teams[0]?.id || '' : '',
                  });
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {grouped.blockSections.map(({ block, shifts: blockShifts }) => (
          <Card key={block.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">
                  {block.is_floor_default ? '★ ' : ''}
                  {block.name}
                </CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  Bulk · {block.kind} · {block.start_date} → {block.end_date} · {blockShifts.length} shift{blockShifts.length === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-zinc-500">
                  {block.location || 'No location'} · capacity {block.capacity || 'open'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditBlock(block)}
                    className={editingBlockId === block.id ? 'border-[#e7c15a]/50 text-[#e7c15a]' : undefined}
                  >
                    {editingBlockId === block.id ? 'Editing…' : 'Edit block'}
                  </Button>
                ) : null}
                {canCreate ? (
                  <Button variant="outline" size="sm" onClick={() => startAppend(block)}>Add shifts</Button>
                ) : null}
                {canDelete ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => void removeBlock(block.id, 'with_shifts')}>
                      Delete block
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void removeBlock(block.id, 'ungroup')}>
                      Ungroup
                    </Button>
                  </>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {appendBlockId === block.id ? (
                <div className="grid gap-3 rounded-2xl border border-white/15 bg-black/30 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="From date">
                    <input className={controlClass} type="date" value={append.startDate} onChange={(event) => setAppend({ ...append, startDate: event.target.value })} />
                  </Field>
                  <Field label="To date">
                    <input className={controlClass} type="date" value={append.endDate} onChange={(event) => setAppend({ ...append, endDate: event.target.value })} />
                  </Field>
                  <Field label="Location">
                    <input className={controlClass} value={append.location} onChange={(event) => setAppend({ ...append, location: event.target.value })} />
                  </Field>
                  <Field label="Capacity">
                    <input className={controlClass} type="number" min={0} value={append.capacity} onChange={(event) => setAppend({ ...append, capacity: event.target.value })} />
                  </Field>
                  <div className="md:col-span-2 xl:col-span-4 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
                      <input type="checkbox" checked={append.morning} onChange={(event) => setAppend({ ...append, morning: event.target.checked })} />
                      Morning · {append.morningStart}–{append.morningEnd}
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
                      <input type="checkbox" checked={append.afternoon} onChange={(event) => setAppend({ ...append, afternoon: event.target.checked })} />
                      Afternoon · {append.afternoonStart}–{append.afternoonEnd}
                    </label>
                  </div>
                  <div className="md:col-span-2 xl:col-span-4">
                    <Field label="Sectors for new shifts">
                      <SectorChecklist value={append.sectors} onChange={(sectors) => setAppend({ ...append, sectors })} />
                    </Field>
                  </div>
                  {appendCandidates.length ? (
                    <div className="md:col-span-2 xl:col-span-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {appendCandidates.map((slot) => {
                        const key = slotKey(slot);
                        const checked = appendSlots.includes(key);
                        return (
                          <label
                            key={key}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm',
                              checked
                                ? 'border-[#e7c15a]/45 bg-[#e7c15a]/10 text-white'
                                : 'border-white/10 bg-black/25 text-zinc-300',
                            )}
                          >
                            <input type="checkbox" className="mt-1" checked={checked} onChange={() => toggleAppendSlot(key)} />
                            <span>{periodLabel(slot.period)} · {slot.date}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="md:col-span-2 xl:col-span-4 text-sm text-zinc-500">Pick dates to list shifts to add.</p>
                  )}
                  <div className="flex gap-2 md:col-span-2 xl:col-span-4">
                    <Button disabled={!appendCount} onClick={() => void saveAppend()}>
                      Add {appendCount || 0} shift{appendCount === 1 ? '' : 's'}
                    </Button>
                    <Button variant="outline" onClick={() => setAppendBlockId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}

              {blockShifts.length ? blockShifts.map(renderShiftRow) : (
                <p className="text-sm text-zinc-500">No shifts in this block yet.</p>
              )}
            </CardContent>
          </Card>
        ))}

        {grouped.ungrouped.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ungrouped shifts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {grouped.ungrouped.map(renderShiftRow)}
            </CardContent>
          </Card>
        ) : null}

        {!shifts.length && !blocks.length ? (
          <p className="text-sm text-zinc-400">No shifts yet. Add a training or ops duty block above.</p>
        ) : null}
      </div>
    </div>
  );
}
