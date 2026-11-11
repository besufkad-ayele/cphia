'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  SECTORS,
  normalizeSector,
  sectorHasSubsectors,
  sectorsMatch,
  subsectorLabelForSector,
  subsectorOptionsForSector,
} from '@cphia/shared/constants';
import {
  ATTENDANCE_PERSON_COLUMNS,
  DEFAULT_PERSON_DAY_EXPORT_COLUMNS,
  sheetStatusLabel,
} from '@/app/lib/admin/attendance-columns';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { ExportColumnsDialog } from '@/components/admin/export-columns-dialog';
import { CphiaLoader } from '@/components/brand/cphia-loader';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

const REPORTS_STORAGE_KEY = 'cphia.attendance.reports.state';

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
  came: boolean;
  attendedDates: string[];
  absentDates: string[];
  shiftsTotal: number;
  shiftsAttended: number;
  morningShifts: number;
  afternoonShifts: number;
  morningAttended: number;
  afternoonAttended: number;
  participationPercent: number;
  shiftParticipationPercent: number;
};

type DaySector = {
  sector: string;
  peopleCount: number;
  peopleCame: number;
  peopleNever: number;
  daysTotal: number;
  daysAttended: number;
  daysAbsent: number;
  shiftsTotal: number;
  shiftsAttended: number;
  participationPercent: number;
  shiftParticipationPercent: number;
};

type DayRow = {
  date: string;
  people: number;
  attended: number;
  absent: number;
  shifts: number;
  participationPercent: number;
};

type DaySummary = {
  totals: {
    people: number;
    peopleCame: number;
    peopleNever: number;
    daysTotal: number;
    daysAttended: number;
    daysAbsent: number;
    shiftsTotal: number;
    shiftsAttended: number;
    participationPercent: number;
    shiftParticipationPercent: number;
  };
  byPerson: DayPerson[];
  bySector: DaySector[];
  byDay: DayRow[];
};

const EMPTY_DAY: DaySummary = {
  totals: {
    people: 0,
    peopleCame: 0,
    peopleNever: 0,
    daysTotal: 0,
    daysAttended: 0,
    daysAbsent: 0,
    shiftsTotal: 0,
    shiftsAttended: 0,
    participationPercent: 0,
    shiftParticipationPercent: 0,
  },
  byPerson: [],
  bySector: [],
  byDay: [],
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
  day?: DaySummary | null;
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
type CameFilter = 'all' | 'came' | 'never';

type ReportsUiState = {
  view: View;
  filters: BlockFilters;
  selectedShiftIds: string[] | null;
  blockTab: BlockTab;
  sectorFocus: string;
  cameFilter: CameFilter;
};

function isBlockTab(value: string | null): value is BlockTab {
  return value === 'sector' || value === 'person' || value === 'day';
}

function isCameFilter(value: string | null): value is CameFilter {
  return value === 'all' || value === 'came' || value === 'never';
}

function parseReportsState(params: URLSearchParams): ReportsUiState {
  const blockId = params.get('block') || '';
  const shiftId = params.get('shift') || '';
  const fromBlockId = params.get('fromBlock') || undefined;
  const shiftIdsRaw = params.get('shiftIds');
  const selectedShiftIds = shiftIdsRaw == null
    ? null
    : shiftIdsRaw.split(',').map((item) => item.trim()).filter(Boolean);
  const tab = params.get('tab');
  const came = params.get('came');
  const view: View = shiftId
    ? { kind: 'shift', shiftId, fromBlockId: fromBlockId || blockId || undefined }
    : blockId
      ? { kind: 'block', blockId }
      : { kind: 'list' };

  return {
    view,
    filters: {
      sector: params.get('sector') || '',
      subsector: params.get('subsector') || '',
      search: params.get('q') || '',
      includePending: params.get('pending') !== '0',
    },
    selectedShiftIds,
    blockTab: isBlockTab(tab) ? tab : 'sector',
    sectorFocus: params.get('focus') || '',
    cameFilter: isCameFilter(came) ? came : 'all',
  };
}

function buildReportsSearch(state: ReportsUiState) {
  const params = new URLSearchParams();
  if (state.view.kind === 'block') params.set('block', state.view.blockId);
  if (state.view.kind === 'shift') {
    params.set('shift', state.view.shiftId);
    if (state.view.fromBlockId) params.set('fromBlock', state.view.fromBlockId);
    if (state.view.fromBlockId) params.set('block', state.view.fromBlockId);
  }
  if (state.selectedShiftIds) params.set('shiftIds', state.selectedShiftIds.join(','));
  if (state.filters.sector) params.set('sector', state.filters.sector);
  if (sectorHasSubsectors(state.filters.sector) && state.filters.subsector) {
    params.set('subsector', state.filters.subsector);
  }
  if (state.filters.search.trim()) params.set('q', state.filters.search.trim());
  if (!state.filters.includePending) params.set('pending', '0');
  if (state.blockTab !== 'sector') params.set('tab', state.blockTab);
  if (state.sectorFocus) params.set('focus', state.sectorFocus);
  if (state.cameFilter !== 'all') params.set('came', state.cameFilter);
  return params.toString();
}

function reportsPath(state: ReportsUiState) {
  const query = buildReportsSearch(state);
  return query ? `/admin/attendance/reports?${query}` : '/admin/attendance/reports';
}

function readStoredReportsState(): ReportsUiState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportsUiState;
    if (!parsed?.view?.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredReportsState(state: ReportsUiState) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

function formatShortDate(value: string) {
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[1]}/${parts[2]}`;
}

function formatDateList(dates: string[]) {
  if (!dates.length) return '—';
  return dates.map(formatShortDate).join(', ');
}

function sheetStatusTone(status: string) {
  if (status === 'verified') return 'text-emerald-300';
  if (status === 'submitted') return 'text-amber-200';
  return 'text-zinc-400';
}

function buildBlockParams(filters: BlockFilters, shiftIds?: string[] | null) {
  const params = new URLSearchParams();
  if (filters.sector) params.set('sector', filters.sector);
  if (sectorHasSubsectors(filters.sector) && filters.subsector) params.set('subsector', filters.subsector);
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (!filters.includePending) params.set('verifiedOnly', '1');
  // undefined = default all sheets; array (including empty) = exact checklist
  if (shiftIds != null) params.set('shiftIds', shiftIds.join(','));
  return params;
}

function AttendanceReportsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrapped = useRef(false);

  const initial = useMemo(() => {
    const fromUrl = parseReportsState(searchParams);
    if (fromUrl.view.kind !== 'list') return fromUrl;
    return readStoredReportsState() ?? fromUrl;
  }, [searchParams]);

  const [view, setView] = useState<View>(initial.view);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canExport, setCanExport] = useState(false);
  const [blocks, setBlocks] = useState<BlockCard[]>([]);
  const [ungrouped, setUngrouped] = useState<UngroupedShift[]>([]);
  const [blockDetail, setBlockDetail] = useState<BlockDetail | null>(null);
  const [shiftDetail, setShiftDetail] = useState<ShiftDetail | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>(initial.selectedShiftIds ?? []);
  const [filters, setFilters] = useState<BlockFilters>(initial.filters);
  const [draft, setDraft] = useState<BlockFilters>(initial.filters);
  const [blockTab, setBlockTab] = useState<BlockTab>(initial.blockTab);
  const [sectorFocus, setSectorFocus] = useState(initial.sectorFocus);
  const [cameFilter, setCameFilter] = useState<CameFilter>(initial.cameFilter);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([...DEFAULT_PERSON_DAY_EXPORT_COLUMNS]);
  const [exportMode, setExportMode] = useState<'day' | 'period'>('day');

  const uiState = useMemo<ReportsUiState>(() => ({
    view,
    filters,
    selectedShiftIds: view.kind === 'list' ? null : selectedShiftIds,
    blockTab,
    sectorFocus,
    cameFilter,
  }), [view, filters, selectedShiftIds, blockTab, sectorFocus, cameFilter]);

  const reportsHrefNow = useMemo(() => reportsPath(uiState), [uiState]);

  function volunteerProfileHref(registrationId: string) {
    return `/admin/volunteers/${registrationId}?return=${encodeURIComponent(reportsHrefNow)}`;
  }

  async function loadList(options?: { clearSelection?: boolean }) {
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
      if (options?.clearSelection !== false) {
        setBlockDetail(null);
        setShiftDetail(null);
        setSelectedShiftIds([]);
        setView({ kind: 'list' });
      }
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
    options?: { resetTab?: boolean; focusSector?: string },
  ) {
    setLoading(true);
    setError(null);
    try {
      const params = buildBlockParams(nextFilters, shiftIds);
      const payload = await adminFetch<BlockDetail>(`/api/admin/attendance/reports/blocks/${blockId}?${params}`);
      const day = payload.day ?? EMPTY_DAY;
      setCanExport(payload.canExport);
      setBlockDetail({ ...payload, day });
      setShiftDetail(null);
      setSelectedShiftIds(payload.selectedShiftIds ?? []);
      setView({ kind: 'block', blockId });
      if (options?.resetTab) setBlockTab('sector');
      const preferredFocus = options?.focusSector || sectorFocus || nextFilters.sector;
      if (preferredFocus) {
        setSectorFocus(preferredFocus);
      } else if (!sectorFocus && day.bySector[0]) {
        setSectorFocus(day.bySector[0].sector);
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
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const start = initial;
    setFilters(start.filters);
    setDraft(start.filters);
    setBlockTab(start.blockTab);
    setSectorFocus(start.sectorFocus);
    setCameFilter(start.cameFilter);
    if (start.selectedShiftIds) setSelectedShiftIds(start.selectedShiftIds);

    void (async () => {
      await loadList({ clearSelection: false });
      if (start.view.kind === 'block') {
        await loadBlock(start.view.blockId, start.filters, start.selectedShiftIds, {
          focusSector: start.sectorFocus || start.filters.sector,
        });
        if (start.blockTab) setBlockTab(start.blockTab);
        if (start.cameFilter) setCameFilter(start.cameFilter);
      } else if (start.view.kind === 'shift') {
        if (start.view.fromBlockId) {
          await loadBlock(start.view.fromBlockId, start.filters, start.selectedShiftIds, {
            focusSector: start.sectorFocus || start.filters.sector,
          });
        }
        await loadShift(start.view.shiftId, start.view.fromBlockId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped.current) return;
    writeStoredReportsState(uiState);
    const next = reportsPath(uiState);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === next) return;
    router.replace(href(next), { scroll: false });
  }, [uiState, router]);

  function applyBlockFilters() {
    if (view.kind !== 'block') return;
    const sector = normalizeSector(draft.sector) || draft.sector;
    const next = {
      ...draft,
      sector,
      subsector: sectorHasSubsectors(sector) ? draft.subsector : '',
    };
    setDraft(next);
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
      layout: exportMode === 'period' ? 'person-period' : 'person-day',
    });
    if (view.kind === 'block') {
      params.set('blockId', view.blockId);
      if (selectedShiftIds.length) params.set('shiftIds', selectedShiftIds.join(','));
    }
    if (view.kind === 'shift') {
      params.set('shiftId', view.shiftId);
      // Single sheet still exports one row per approved volunteer with that date column.
      params.set('layout', exportMode === 'period' ? 'person-period' : 'person-day');
    }
    if (filters.sector) params.set('sector', filters.sector);
    if (sectorHasSubsectors(filters.sector) && filters.subsector) params.set('subsector', filters.subsector);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    if (!filters.includePending) params.set('verifiedOnly', '1');
    window.location.href = `/api/admin/attendance/export?${params.toString()}`;
    setExportOpen(false);
  }

  const selectedDates = useMemo(() => {
    if (!blockDetail?.shifts?.length) return [] as string[];
    return [...new Set(
      blockDetail.shifts
        .filter((shift) => selectedShiftIds.includes(shift.id))
        .map((shift) => shift.shiftDate),
    )].sort();
  }, [blockDetail, selectedShiftIds]);

  const daySummary = blockDetail?.day ?? EMPTY_DAY;

  const activeSector = normalizeSector(sectorFocus || filters.sector) || sectorFocus || filters.sector;

  const peopleForSector = useMemo(() => {
    let list = activeSector
      ? daySummary.byPerson.filter((person) => sectorsMatch(person.sector, activeSector))
      : daySummary.byPerson;
    if (cameFilter === 'came') list = list.filter((person) => person.came);
    if (cameFilter === 'never') list = list.filter((person) => !person.came);
    return list;
  }, [daySummary, activeSector, cameFilter]);

  const focusedSectorStats = useMemo(() => {
    if (!activeSector) return null;
    return daySummary.bySector.find((row) => sectorsMatch(row.sector, activeSector)) ?? null;
  }, [daySummary.bySector, activeSector]);

  const selectionNote = selectedDates.length
    ? `${selectedDates.length} day(s) · ${selectedShiftIds.length} sheet(s)`
    : 'No sheets selected';

  const sectorHighlights = useMemo(() => {
    if (!daySummary.bySector.length) return null;
    const sectors = daySummary.bySector;
    const mostConsistent = [...sectors].sort(
      (a, b) => b.participationPercent - a.participationPercent || b.peopleCame - a.peopleCame,
    )[0];
    const highestTurnover = [...sectors]
      .filter((row) => row.peopleCount > 0)
      .sort((a, b) => {
        const aRate = a.peopleNever / a.peopleCount;
        const bRate = b.peopleNever / b.peopleCount;
        return bRate - aRate || b.peopleNever - a.peopleNever;
      })[0];
    const returning = daySummary.byPerson.filter((person) => person.daysAttended >= 2).length;
    return { mostConsistent, highestTurnover, returning };
  }, [daySummary]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          kicker="REPORTS"
          title="Attendance reports"
          description="Counts approved volunteers only. Open a training block, tick morning/afternoon sheets, then see who came by sector and person. Morning or afternoon = 1 training day; shift sheets stay separate."
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
                  void loadList({ clearSelection: true });
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
                  void loadBlock(block.id, EMPTY_BLOCK_FILTERS, null, { resetTab: true });
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
                        {shift.teamName ? ` · ${shift.teamName}` : ''} · {sheetStatusLabel(shift.sheetStatus)}
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
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Stat
                label={activeSector ? `${activeSector} who came` : 'Approved who came'}
                value={
                  focusedSectorStats
                    ? `${focusedSectorStats.peopleCame}/${focusedSectorStats.peopleCount}`
                    : `${daySummary.totals.peopleCame}/${daySummary.totals.people}`
                }
                note={
                  focusedSectorStats
                    ? `${focusedSectorStats.peopleNever} in ${activeSector} never came · ${selectionNote}`
                    : `${daySummary.totals.peopleNever} approved never came · ${selectionNote}`
                }
              />
              <Stat
                label="Person-day attendance rate"
                value={`${focusedSectorStats?.participationPercent ?? daySummary.totals.participationPercent}%`}
                note={
                  focusedSectorStats
                    ? `${focusedSectorStats.daysAttended} of ${focusedSectorStats.daysTotal} person-days in ${activeSector}`
                    : `${daySummary.totals.daysAttended} of ${daySummary.totals.daysTotal} rostered person-days`
                }
              />
              <Stat
                label="Training days attended"
                value={String(focusedSectorStats?.daysAttended ?? daySummary.totals.daysAttended)}
                note="morning and/or afternoon = 1 day"
              />
              <Stat
                label="Training days missed"
                value={String(focusedSectorStats?.daysAbsent ?? daySummary.totals.daysAbsent)}
                note="on a sheet but missed both periods"
              />
              <Stat
                label="Shift sheets attended"
                value={
                  focusedSectorStats
                    ? `${focusedSectorStats.shiftsAttended}/${focusedSectorStats.shiftsTotal}`
                    : `${daySummary.totals.shiftsAttended}/${daySummary.totals.shiftsTotal}`
                }
                note="each morning/afternoon mark"
              />
              <Stat
                label="Shift-sheet attendance rate"
                value={`${focusedSectorStats?.shiftParticipationPercent ?? daySummary.totals.shiftParticipationPercent}%`}
                note="present or late on a sheet"
              />
            </CardContent>
          </Card>

          {sectorHighlights ? (
            <Card>
              <CardHeader>
                <CardTitle>Training highlights</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  Quick read on consistency and no-shows among approved volunteers in this selection.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Most consistent sector"
                  value={sectorHighlights.mostConsistent.sector}
                  note={`${sectorHighlights.mostConsistent.participationPercent}% person-day rate · ${sectorHighlights.mostConsistent.peopleCame} came`}
                />
                <Stat
                  label="Highest no-show sector"
                  value={sectorHighlights.highestTurnover.sector}
                  note={`${sectorHighlights.highestTurnover.peopleNever}/${sectorHighlights.highestTurnover.peopleCount} approved never came`}
                />
                <Stat
                  label="Returning volunteers"
                  value={String(sectorHighlights.returning)}
                  note="Approved people who came on 2+ training days"
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Select sheets (checklist)</CardTitle>
              <p className="text-sm text-zinc-400">
                Tick Monday morning + afternoon + Tuesday morning + afternoon to score two training days. Sheet status: Pending (open), Submitted, Completed (verified).
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
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-white">{shift.shiftDate} · {shift.period}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>{shift.startTime}–{shift.endTime}</span>
                          <span className={cn('font-medium', sheetStatusTone(shift.sheetStatus))}>
                            {sheetStatusLabel(shift.sheetStatus)}
                          </span>
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
                      subsector:
                        sectorHasSubsectors(sector) &&
                        subsectorOptionsForSector(sector).includes(prev.subsector)
                          ? prev.subsector
                          : '',
                    }));
                  }}
                >
                  <option value="">All sectors</option>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </Field>
              {sectorHasSubsectors(draft.sector) ? (
                <Field label={subsectorLabelForSector(draft.sector)}>
                  <select
                    className={controlClass}
                    value={draft.subsector}
                    onChange={(event) => setDraft((prev) => ({ ...prev, subsector: event.target.value }))}
                  >
                    <option value="">All</option>
                    {subsectorOptionsForSector(draft.sector).map((item) => (
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
                    People = approved volunteers in that sector. Came / never came are from that approved pool only (unapproved registrations are ignored). Click a sector to open its people list with day-by-day and shift counts.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sector</TableHead>
                        <TableHead>Approved people</TableHead>
                        <TableHead>Came at least once</TableHead>
                        <TableHead>Never came</TableHead>
                        <TableHead>Training days attended</TableHead>
                        <TableHead>Training days missed</TableHead>
                        <TableHead>Shift sheets attended</TableHead>
                        <TableHead>Person-day rate</TableHead>
                        <TableHead>Shift-sheet rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daySummary.bySector.map((row) => (
                        <TableRow
                          key={row.sector}
                          className={cn('cursor-pointer', sectorFocus === row.sector ? 'bg-[#e7c15a]/10' : '')}
                          onClick={() => {
                            const sector = normalizeSector(row.sector) || row.sector;
                            setSectorFocus(sector);
                            setCameFilter('all');
                            const next = {
                              ...draft,
                              sector,
                              subsector: sectorHasSubsectors(sector) ? draft.subsector : '',
                            };
                            setDraft(next);
                            setFilters(next);
                            setBlockTab('person');
                            if (view.kind === 'block') {
                              void loadBlock(view.blockId, next, selectedShiftIds, { focusSector: sector });
                            }
                          }}
                        >
                          <TableCell className="font-medium text-[#f6e7b2] underline-offset-2 hover:underline">
                            {row.sector}
                          </TableCell>
                          <TableCell>{row.peopleCount}</TableCell>
                          <TableCell>{row.peopleCame}</TableCell>
                          <TableCell>{row.peopleNever}</TableCell>
                          <TableCell>{row.daysAttended}</TableCell>
                          <TableCell>{row.daysAbsent}</TableCell>
                          <TableCell>{row.shiftsAttended}/{row.shiftsTotal}</TableCell>
                          <TableCell className="text-[#f6e7b2]">{row.participationPercent}%</TableCell>
                          <TableCell>{row.shiftParticipationPercent}%</TableCell>
                        </TableRow>
                      ))}
                      {daySummary.bySector.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-zinc-400">No approved volunteers in this selection.</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {blockTab === 'person' ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <Button size="sm" variant="outline" onClick={() => setBlockTab('sector')}>
                      Back to sectors
                    </Button>
                    <Field label="Focus sector">
                      <select
                        className={controlClass}
                        value={sectorFocus}
                        onChange={(event) => setSectorFocus(event.target.value)}
                      >
                        <option value="">All approved sectors</option>
                        {daySummary.bySector.map((row) => (
                          <option key={row.sector} value={row.sector}>{row.sector}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Attendance">
                      <select
                        className={controlClass}
                        value={cameFilter}
                        onChange={(event) => setCameFilter(event.target.value as CameFilter)}
                      >
                        <option value="all">All approved people</option>
                        <option value="came">Came at least once</option>
                        <option value="never">Never came</option>
                      </select>
                    </Field>
                    <p className="pb-2 text-sm text-zinc-400">
                      {peopleForSector.length} approved · day = morning and/or afternoon · shifts = each sheet mark
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Volunteer name</TableHead>
                        <TableHead>Registration ID</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead>Days attended / total</TableHead>
                        <TableHead>Dates came</TableHead>
                        <TableHead>Dates missed</TableHead>
                        <TableHead>Shift sheets</TableHead>
                        <TableHead>Morning sheets</TableHead>
                        <TableHead>Afternoon sheets</TableHead>
                        <TableHead>Person-day rate</TableHead>
                        <TableHead className="w-[1%] whitespace-nowrap">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {peopleForSector.map((person) => (
                        <TableRow key={person.registrationId} className="hover:bg-white/5">
                          <TableCell className="text-[#f6e7b2]">
                            {person.name || 'Volunteer'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{person.publicId}</TableCell>
                          <TableCell>{person.sector}</TableCell>
                          <TableCell>
                            {person.daysAttended}/{person.daysTotal}
                            <span className="block text-[11px] text-zinc-500">{person.daysAbsent} absent</span>
                          </TableCell>
                          <TableCell className="max-w-[10rem] text-xs text-zinc-200">
                            {formatDateList(person.attendedDates)}
                          </TableCell>
                          <TableCell className="max-w-[10rem] text-xs text-zinc-400">
                            {formatDateList(person.absentDates)}
                          </TableCell>
                          <TableCell>
                            {person.shiftsAttended}/{person.shiftsTotal}
                            <span className="block text-[11px] text-zinc-500">{person.shiftParticipationPercent}%</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {person.morningAttended}/{person.morningShifts}
                          </TableCell>
                          <TableCell className="text-xs">
                            {person.afternoonAttended}/{person.afternoonShifts}
                          </TableCell>
                          <TableCell>{person.participationPercent}%</TableCell>
                          <TableCell>
                            <Link
                              href={href(volunteerProfileHref(person.registrationId))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1')}
                              title="Open profile in new page"
                            >
                              <ExternalLink className="size-3.5" />
                              New page
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {peopleForSector.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-zinc-400">No people for this sector / filter.</TableCell>
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
                        <TableHead>Training date</TableHead>
                        <TableHead>Sheets selected</TableHead>
                        <TableHead>Approved on sheets</TableHead>
                        <TableHead>Came that day</TableHead>
                        <TableHead>Missed that day</TableHead>
                        <TableHead>Person-day rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daySummary.byDay.map((day) => (
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
                              {shift.shiftDate} · {shift.period} · {sheetStatusLabel(shift.sheetStatus)}
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
                {' · '}
                {sheetStatusLabel(shiftDetail.shift.sheetStatus)}
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
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
              >
                <ExternalLink className="size-3.5" />
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
                    <TableHead className="w-[1%] whitespace-nowrap">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftDetail.volunteers.map((person) => (
                    <TableRow key={person.markId} className="hover:bg-white/5">
                      <TableCell className={person.registrationId ? 'text-[#f6e7b2]' : undefined}>
                        {person.name || person.publicId || '—'}
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
                      <TableCell>
                        {person.registrationId ? (
                          <Link
                            href={href(volunteerProfileHref(person.registrationId))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1')}
                            title="Open profile in new page"
                          >
                            <ExternalLink className="size-3.5" />
                            New page
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {shiftDetail.volunteers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-zinc-400">No marks on this shift yet.</TableCell>
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
        columnOptions={ATTENDANCE_PERSON_COLUMNS}
        title="Export attendance"
        description="One row per approved volunteer (no duplicated people). Date columns use headers like Monday 09. Identity columns below; attendance dates are added automatically for the selected sheets."
        onExport={runExport}
      >
        <div className="mb-3 grid gap-2">
          <p className="text-sm text-zinc-300">Attendance columns</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={exportMode === 'day' ? 'default' : 'outline'}
              onClick={() => setExportMode('day')}
            >
              Day columns (Monday 09)
            </Button>
            <Button
              size="sm"
              variant={exportMode === 'period' ? 'default' : 'outline'}
              onClick={() => setExportMode('period')}
            >
              Morning / afternoon columns
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Day mode: Came / Missed / Not on sheet. Period mode: Present / Late / Absent per morning and afternoon.
          </p>
        </div>
      </ExportColumnsDialog>
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

export default function AttendanceReportsPage() {
  return (
    <Suspense fallback={<CphiaLoader fullscreen size="lg" label="Loading reports" />}>
      <AttendanceReportsPageInner />
    </Suspense>
  );
}
