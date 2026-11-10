'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { HEALTH_SUBSECTORS, SECTORS } from '@cphia/shared/constants';
import {
  ATTENDANCE_EXPORT_COLUMNS,
  DEFAULT_ATTENDANCE_EXPORT_COLUMNS,
} from '@/app/lib/admin/attendance-columns';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { ExportColumnsDialog } from '@/components/admin/export-columns-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type Totals = { total: number; present: number; late: number; absent: number; excused: number; attended: number };
type Averages = {
  avgParticipationPercent: number;
  avgAttendedPerDay: number;
  avgRosterPerDay: number;
  dayCount: number;
};

type BlockCard = {
  id: string;
  name: string;
  kind: string;
  startDate: string;
  endDate: string;
  location: string;
  capacity: number;
  cohortCode: string;
  cohortName: string;
  teamName: string;
  shiftCount: number;
  verifiedShifts: number;
  pendingShifts: number;
  totals: Totals;
  averages: Averages;
};

type UngroupedShift = {
  id: string;
  name: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  kind: string;
  sheetStatus: string;
  cohortCode: string;
  teamName: string;
};

type BlockShift = {
  id: string;
  name: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  period: string;
  periodKey: 'morning' | 'afternoon';
  sheetStatus: string;
  kind: string;
};

type DayPerson = {
  registrationId: string;
  publicId: string;
  name: string;
  sector: string;
  daysTotal: number;
  daysAttended: number;
  daysAbsent: number;
  participationPercent: number;
};

type DaySector = {
  sector: string;
  peopleCount: number;
  daysTotal: number;
  daysAttended: number;
  daysAbsent: number;
  participationPercent: number;
};

type DayRow = {
  date: string;
  people: number;
  attended: number;
  absent: number;
  shifts: number;
  participationPercent: number;
};

type BlockDetail = {
  canExport: boolean;
  countingMode: 'day';
  block: {
    id: string;
    name: string;
    kind: string;
    startDate: string;
    endDate: string;
    location: string;
    capacity: number;
    notes: string;
    cohortCode: string;
    cohortName: string;
    teamName: string;
  };
  shifts: BlockShift[];
  selectedShiftIds: string[];
  day: {
    totals: {
      people: number;
      daysTotal: number;
      daysAttended: number;
      daysAbsent: number;
      participationPercent: number;
    };
    byPerson: DayPerson[];
    bySector: DaySector[];
    byDay: DayRow[];
  };
  marks: {
    totals: Totals;
    byShift: Array<{
      shiftId: string;
      shiftName: string;
      shiftDate: string;
      period: string;
      sheetStatus: string;
      present: number;
      late: number;
      absent: number;
      excused: number;
      total: number;
      attended: number;
      participationPercent: number;
    }>;
  };
};

type ShiftDetail = {
  canExport: boolean;
  shift: {
    id: string;
    name: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    period: string;
    kind: string;
    sheetStatus: string;
    location: string;
    capacity: number;
    blockId: string | null;
    cohortCode: string;
    teamName: string;
  };
  totals: Totals;
  volunteers: Array<{
    markId: string;
    status: string;
    notes: string;
    checkedInAt: string | null;
    registrationId: string;
    publicId: string;
    name: string;
    phone: string;
    email: string;
    sector: string;
  }>;
};

type View =
  | { kind: 'list' }
  | { kind: 'block'; blockId: string }
  | { kind: 'shift'; shiftId: string; fromBlockId?: string };

type BlockFilters = {
  sector: string;
  subsector: string;
  search: string;
  includePending: boolean;
};

const EMPTY_BLOCK_FILTERS: BlockFilters = {
  sector: '',
  subsector: '',
  search: '',
  includePending: true,
};

type BlockTab = 'sector' | 'person' | 'day';

function buildBlockParams(filters: BlockFilters, shiftIds?: string[] | null) {
  const params = new URLSearchParams();
  if (filters.sector) params.set('sector', filters.sector);
  if (filters.sector === 'Health' && filters.subsector) params.set('subsector', filters.subsector);
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (!filters.includePending) params.set('verifiedOnly', '1');
  // undefined = default all sheets; array (including empty) = exact checklist
  if (shiftIds != null) params.set('shiftIds', shiftIds.join(','));
  return params;
}

export default function AttendanceReportsPage() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canExport, setCanExport] = useState(false);
  const [blocks, setBlocks] = useState<BlockCard[]>([]);
  const [ungrouped, setUngrouped] = useState<UngroupedShift[]>([]);
  const [blockDetail, setBlockDetail] = useState<BlockDetail | null>(null);
  const [shiftDetail, setShiftDetail] = useState<ShiftDetail | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<BlockFilters>(EMPTY_BLOCK_FILTERS);
  const [draft, setDraft] = useState<BlockFilters>(EMPTY_BLOCK_FILTERS);
  const [blockTab, setBlockTab] = useState<BlockTab>('sector');
  const [sectorFocus, setSectorFocus] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([...DEFAULT_ATTENDANCE_EXPORT_COLUMNS]);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminFetch<{
        canExport: boolean;
        blocks: BlockCard[];
        ungroupedShifts: UngroupedShift[];
      }>('/api/admin/attendance/reports');
      setCanExport(payload.canExport);
      setBlocks(payload.blocks);
      setUngrouped(payload.ungroupedShifts);
      setBlockDetail(null);
      setShiftDetail(null);
      setSelectedShiftIds([]);
      setView({ kind: 'list' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }

  async function loadBlock(
    blockId: string,
    nextFilters: BlockFilters = filters,
    shiftIds?: string[] | null,
  ) {
    setLoading(true);
    setError(null);
    try {
      const params = buildBlockParams(nextFilters, shiftIds);
      const payload = await adminFetch<BlockDetail>(`/api/admin/attendance/reports/blocks/${blockId}?${params}`);
      setCanExport(payload.canExport);
      setBlockDetail(payload);
      setShiftDetail(null);
      setSelectedShiftIds(payload.selectedShiftIds);
      setView({ kind: 'block', blockId });
      setBlockTab('sector');
      if (!sectorFocus && payload.day.bySector[0]) {
        setSectorFocus(payload.day.bySector[0].sector);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load block report.');
    } finally {
      setLoading(false);
    }
  }

  async function loadShift(shiftId: string, fromBlockId?: string) {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminFetch<ShiftDetail>(`/api/admin/attendance/reports/shifts/${shiftId}`);
      setCanExport(payload.canExport);
      setShiftDetail(payload);
      setView({ kind: 'shift', shiftId, fromBlockId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load shift report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  function applyBlockFilters() {
    if (view.kind !== 'block') return;
    const next = {
      ...draft,
      subsector: draft.sector === 'Health' ? draft.subsector : '',
    };
    setFilters(next);
    if (next.sector) setSectorFocus(next.sector);
    void loadBlock(view.blockId, next, selectedShiftIds);
  }

  function applyShiftSelection(nextIds: string[]) {
    if (view.kind !== 'block') return;
    setSelectedShiftIds(nextIds);
    void loadBlock(view.blockId, filters, nextIds);
  }

  function toggleShift(shiftId: string) {
    const next = selectedShiftIds.includes(shiftId)
      ? selectedShiftIds.filter((id) => id !== shiftId)
      : [...selectedShiftIds, shiftId];
    applyShiftSelection(next);
  }

  function selectAllShifts() {
    if (!blockDetail) return;
    applyShiftSelection(blockDetail.shifts.map((shift) => shift.id));
  }

  function selectDays(dates: string[]) {
    if (!blockDetail) return;
    const dateSet = new Set(dates);
    applyShiftSelection(blockDetail.shifts.filter((shift) => dateSet.has(shift.shiftDate)).map((shift) => shift.id));
  }

  function selectPeriod(periodKey: 'morning' | 'afternoon') {
    if (!blockDetail) return;
    applyShiftSelection(blockDetail.shifts.filter((shift) => shift.periodKey === periodKey).map((shift) => shift.id));
  }

  function openExport() {
    if (!canExport) {
      toast.error('Only verify-capable admins can export.');
      return;
    }
    if (view.kind === 'list') {
      toast.error('Open a bulk block or shift first, then export.');
      return;
    }
    setExportOpen(true);
  }

  function runExport(format: 'csv' | 'xlsx') {
    const params = new URLSearchParams({
      format,
      columns: selectedColumns.join(','),
    });
    if (view.kind === 'block') {
      params.set('blockId', view.blockId);
      if (selectedShiftIds.length) params.set('shiftIds', selectedShiftIds.join(','));
    }
    if (view.kind === 'shift') params.set('shiftId', view.shiftId);
    if (filters.sector) params.set('sector', filters.sector);
    if (filters.sector === 'Health' && filters.subsector) params.set('subsector', filters.subsector);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    if (!filters.includePending) params.set('verifiedOnly', '1');
    window.location.href = `/api/admin/attendance/export?${params.toString()}`;
    setExportOpen(false);
  }

  const selectedDates = useMemo(() => {
    if (!blockDetail) return [] as string[];
    return [...new Set(
      blockDetail.shifts
        .filter((shift) => selectedShiftIds.includes(shift.id))
        .map((shift) => shift.shiftDate),
    )].sort();
  }, [blockDetail, selectedShiftIds]);

  const peopleForSector = useMemo(() => {
    if (!blockDetail) return [] as DayPerson[];
    const sector = sectorFocus || filters.sector;
    if (!sector) return blockDetail.day.byPerson;
    return blockDetail.day.byPerson.filter((person) => person.sector === sector);
  }, [blockDetail, sectorFocus, filters.sector]);

  const selectionNote = selectedDates.length
    ? `${selectedDates.length} day(s) · ${selectedShiftIds.length} sheet(s)`
    : 'No sheets selected';

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          kicker="REPORTS"
          title="Attendance reports"
          description="Open a bulk training block, tick the morning/afternoon sheets you want, then read day-based rates (late = present; morning or afternoon = one day)."
        />
        <div className="flex flex-wrap gap-2">
          <Link href={href('/admin/attendance')} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
            Back to desk
          </Link>
          {view.kind !== 'list' ? (
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                if (view.kind === 'shift' && view.fromBlockId) {
                  void loadBlock(view.fromBlockId, filters, selectedShiftIds);
                } else {
                  void loadList();
                }
              }}
            >
              {view.kind === 'shift' && view.fromBlockId ? 'Back to block' : 'All blocks'}
            </Button>
          ) : null}
          {canExport && view.kind !== 'list' ? (
            <Button className="h-11" onClick={openExport}>Export</Button>
          ) : null}
        </div>
      </div>
      <Banner message={error} />

      {view.kind === 'list' ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {blocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => {
                  setFilters(EMPTY_BLOCK_FILTERS);
                  setDraft(EMPTY_BLOCK_FILTERS);
                  setSelectedShiftIds([]);
                  setSectorFocus('');
                  void loadBlock(block.id, EMPTY_BLOCK_FILTERS, null);
                }}
                className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-[#e7c15a]/40 hover:bg-[#e7c15a]/5"
              >
                <p className="text-[11px] uppercase tracking-wide text-[#e7c15a]">
                  {block.kind === 'training' ? 'Training block' : 'Bulk block'}
                </p>
                <p className="mt-1 text-lg font-semibold text-white">{block.name}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {block.cohortCode || block.cohortName || 'Event'}
                  {block.teamName ? ` · ${block.teamName}` : ''}
                  {' · '}
                  {block.kind}
                </p>
                <p className="text-xs text-zinc-500">
                  {block.startDate} → {block.endDate} · {block.shiftCount} sheets
                  {block.pendingShifts ? ` · ${block.pendingShifts} pending` : ''}
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  Open to pick days / morning+afternoon and see day rates
                </p>
              </button>
            ))}
            {!loading && blocks.length === 0 ? (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="pt-4 text-sm text-zinc-400">
                  No bulk blocks yet. Create a morning / afternoon date range under Shifts.
                </CardContent>
              </Card>
            ) : null}
          </div>

          {ungrouped.length ? (
            <Card>
              <CardHeader><CardTitle>Single shifts (not in a bulk block)</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {ungrouped.map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => void loadShift(shift.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-left text-sm hover:bg-white/5"
                  >
                    <div>
                      <p className="font-medium text-white">{shift.name}</p>
                      <p className="text-xs text-zinc-500">
                        {shift.shiftDate} · {shift.startTime}–{shift.endTime} · {shift.cohortCode}
                        {shift.teamName ? ` · ${shift.teamName}` : ''} · sheet {shift.sheetStatus}
                      </p>
                    </div>
                    <span className="text-xs text-[#e7c15a]">Open detail</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {view.kind === 'block' && blockDetail ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{blockDetail.block.name}</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                {blockDetail.block.startDate} → {blockDetail.block.endDate}
                {' · '}
                {blockDetail.block.cohortCode || blockDetail.block.cohortName}
                {blockDetail.block.teamName ? ` · ${blockDetail.block.teamName}` : ''}
                {' · '}training day counting (late = present)
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Day attendance rate"
                value={`${blockDetail.day.totals.participationPercent}%`}
                note={`${blockDetail.day.totals.daysAttended} of ${blockDetail.day.totals.daysTotal} person-days`}
              />
              <Stat label="People" value={String(blockDetail.day.totals.people)} note={selectionNote} />
              <Stat label="Days attended" value={String(blockDetail.day.totals.daysAttended)} note="came morning and/or afternoon" />
              <Stat label="Days absent" value={String(blockDetail.day.totals.daysAbsent)} note="missed both periods that day" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select sheets (checklist)</CardTitle>
              <p className="text-sm text-zinc-400">
                Tick Monday morning + afternoon + Tuesday morning + afternoon to score two training days. Tick morning only to inspect morning sheets.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={selectAllShifts}>All sheets</Button>
                <Button size="sm" variant="outline" onClick={() => selectPeriod('morning')}>All mornings</Button>
                <Button size="sm" variant="outline" onClick={() => selectPeriod('afternoon')}>All afternoons</Button>
                {[...new Set(blockDetail.shifts.map((shift) => shift.shiftDate))].map((date) => (
                  <Button key={date} size="sm" variant="outline" onClick={() => selectDays([date])}>
                    {date} both
                  </Button>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {blockDetail.shifts.map((shift) => {
                  const checked = selectedShiftIds.includes(shift.id);
                  return (
                    <label
                      key={shift.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm',
                        checked ? 'border-[#e7c15a]/50 bg-[#e7c15a]/10' : 'border-white/10 bg-black/25',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleShift(shift.id)}
                      />
                      <span>
                        <span className="block font-medium text-white">{shift.shiftDate} · {shift.period}</span>
                        <span className="block text-xs text-zinc-500">
                          {shift.startTime}–{shift.endTime} · sheet {shift.sheetStatus}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Sector">
                <select
                  className={controlClass}
                  value={draft.sector}
                  onChange={(event) => {
                    const sector = event.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      sector,
                      subsector: sector === 'Health' ? prev.subsector : '',
                    }));
                  }}
                >
                  <option value="">All sectors</option>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </Field>
              {draft.sector === 'Health' ? (
                <Field label="Health sub-sector">
                  <select
                    className={controlClass}
                    value={draft.subsector}
                    onChange={(event) => setDraft((prev) => ({ ...prev, subsector: event.target.value }))}
                  >
                    <option value="">All health sub-sectors</option>
                    {HEALTH_SUBSECTORS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Person search">
                <input
                  className={controlClass}
                  value={draft.search}
                  placeholder="Name · ID · phone"
                  onChange={(event) => setDraft((prev) => ({ ...prev, search: event.target.value }))}
                />
              </Field>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={draft.includePending}
                    onChange={(event) => setDraft((prev) => ({ ...prev, includePending: event.target.checked }))}
                  />
                  Include pending sheets
                </label>
                <Button className="h-10" onClick={applyBlockFilters}>Apply filters</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Training detail</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">{selectionNote}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ['sector', 'By sector'],
                  ['person', 'By person'],
                  ['day', 'By day'],
                ] as const).map(([id, label]) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={blockTab === id ? 'default' : 'outline'}
                    onClick={() => setBlockTab(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {blockTab === 'sector' ? (
                <div className="grid gap-4">
                  <p className="text-sm text-zinc-400">
                    Day rate per sector for the selected sheets. Pick a sector to list its trainees below.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sector</TableHead>
                        <TableHead>People</TableHead>
                        <TableHead>Days attended</TableHead>
                        <TableHead>Days absent</TableHead>
                        <TableHead>Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockDetail.day.bySector.map((row) => (
                        <TableRow
                          key={row.sector}
                          className={cn('cursor-pointer', sectorFocus === row.sector ? 'bg-[#e7c15a]/10' : '')}
                          onClick={() => {
                            setSectorFocus(row.sector);
                            setBlockTab('person');
                          }}
                        >
                          <TableCell>{row.sector}</TableCell>
                          <TableCell>{row.peopleCount}</TableCell>
                          <TableCell>{row.daysAttended}</TableCell>
                          <TableCell>{row.daysAbsent}</TableCell>
                          <TableCell className="text-[#f6e7b2]">{row.participationPercent}%</TableCell>
                        </TableRow>
                      ))}
                      {blockDetail.day.bySector.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-zinc-400">No trainees in this selection.</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {blockTab === 'person' ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Focus sector">
                      <select
                        className={controlClass}
                        value={sectorFocus}
                        onChange={(event) => setSectorFocus(event.target.value)}
                      >
                        <option value="">All sectors in selection</option>
                        {blockDetail.day.bySector.map((row) => (
                          <option key={row.sector} value={row.sector}>{row.sector}</option>
                        ))}
                      </select>
                    </Field>
                    <p className="pb-2 text-sm text-zinc-400">
                      {peopleForSector.length} people · day availability (came either period that day)
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead>Days attended</TableHead>
                        <TableHead>Days absent</TableHead>
                        <TableHead>Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {peopleForSector.map((person) => (
                        <TableRow key={person.registrationId}>
                          <TableCell>
                            <Link href={href(`/admin/volunteers/${person.registrationId}`)} className="text-[#f6e7b2] hover:underline">
                              {person.name || 'Volunteer'}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{person.publicId}</TableCell>
                          <TableCell>{person.sector}</TableCell>
                          <TableCell>{person.daysAttended}</TableCell>
                          <TableCell>{person.daysAbsent}</TableCell>
                          <TableCell>{person.participationPercent}%</TableCell>
                        </TableRow>
                      ))}
                      {peopleForSector.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-zinc-400">No people for this sector / selection.</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {blockTab === 'day' ? (
                <div className="grid gap-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Sheets</TableHead>
                        <TableHead>People</TableHead>
                        <TableHead>Attended (day)</TableHead>
                        <TableHead>Absent (day)</TableHead>
                        <TableHead>Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockDetail.day.byDay.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{day.date}</TableCell>
                          <TableCell>{day.shifts}</TableCell>
                          <TableCell>{day.people}</TableCell>
                          <TableCell>{day.attended}</TableCell>
                          <TableCell>{day.absent}</TableCell>
                          <TableCell className="text-[#f6e7b2]">{day.participationPercent}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Sheet detail (morning / afternoon marks)</p>
                    <div className="grid gap-2">
                      {blockDetail.marks.byShift.map((shift) => (
                        <button
                          key={shift.shiftId}
                          type="button"
                          onClick={() => void loadShift(shift.shiftId, blockDetail.block.id)}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-left hover:border-[#e7c15a]/40"
                        >
                          <div>
                            <p className="font-medium text-white">{shift.shiftName}</p>
                            <p className="text-xs text-zinc-500">
                              {shift.shiftDate} · {shift.period} · sheet {shift.sheetStatus}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-[#f6e7b2]">{shift.participationPercent}%</p>
                            <p className="text-xs text-zinc-500">
                              present+late {shift.attended}/{shift.total} · absent {shift.absent}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {view.kind === 'shift' && shiftDetail ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{shiftDetail.shift.name}</CardTitle>
              <p className="text-sm text-zinc-400">
                {shiftDetail.shift.shiftDate} · {shiftDetail.shift.period} · {shiftDetail.shift.startTime}–{shiftDetail.shift.endTime}
                {' · '}sheet {shiftDetail.shift.sheetStatus}
                {' · '}sheet-level checklist (not day-collapsed)
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Present" value={String(shiftDetail.totals.present)} />
              <Stat label="Late (= present for day rates)" value={String(shiftDetail.totals.late)} />
              <Stat label="Absent / pending" value={String(shiftDetail.totals.absent)} />
              <Stat label="Excused" value={String(shiftDetail.totals.excused)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>Volunteers on this sheet</CardTitle>
              <Link
                href={href(`/admin/attendance?shiftId=${shiftDetail.shift.id}`)}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Open sheet
              </Link>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftDetail.volunteers.map((person) => (
                    <TableRow key={person.markId}>
                      <TableCell>
                        {person.registrationId ? (
                          <Link href={href(`/admin/volunteers/${person.registrationId}`)} className="text-[#f6e7b2] hover:underline">
                            {person.name || person.publicId}
                          </Link>
                        ) : (
                          person.name || '—'
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{person.publicId}</TableCell>
                      <TableCell>{person.sector || '—'}</TableCell>
                      <TableCell className="capitalize">{person.status}</TableCell>
                      <TableCell>
                        {person.checkedInAt
                          ? new Date(person.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TableCell>
                      <TableCell>{person.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {shiftDetail.volunteers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-zinc-400">No marks on this shift yet.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {loading ? <p className="text-sm text-zinc-400">Loading…</p> : null}

      <ExportColumnsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedColumns={selectedColumns}
        onSelectedColumnsChange={setSelectedColumns}
        columnOptions={ATTENDANCE_EXPORT_COLUMNS}
        title="Export attendance"
        description="Exports the selected block sheets with current sector / sub-sector / search filters (sheet-level rows)."
        onExport={runExport}
      />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {note ? <p className="mt-1 text-xs text-zinc-500">{note}</p> : null}
    </div>
  );
}
