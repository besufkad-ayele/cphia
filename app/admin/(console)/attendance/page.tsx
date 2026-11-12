'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { hasCapability } from '@/app/lib/admin/permissions';
import { formatVolunteerName } from '@/app/lib/admin/types';
import {
  AttendanceIdentityPanel,
  AttendanceIdentitySheet,
} from '@/components/admin/attendance-identity-dialog';
import { Banner, controlClass, PageHeader } from '@/components/admin/console';
import { PinBelowHeader } from '@/components/admin/pin-below-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CphiaLoader } from '@/components/brand/cphia-loader';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

const SHIFT_STORAGE_KEY = 'cphia.attendance.shiftId';
const BLOCK_STORAGE_KEY = 'cphia.attendance.blockId';
const UNGROUPED_BLOCK = '__ungrouped__';

type Shift = {
  id: string;
  name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: number;
  kind?: string;
  team_id?: string | null;
  block_id?: string | null;
  sheet_status?: string;
  is_floor_default?: boolean;
  ops_cohorts: { name: string; code: string } | { name: string; code: string }[] | null;
  ops_teams?: { name: string; code: string } | { name: string; code: string }[] | null;
};
type Block = {
  id: string;
  name: string;
  kind: string;
  start_date: string;
  end_date: string;
  location: string;
  team_id?: string | null;
  is_floor_default?: boolean;
};
type Person = {
  id: string;
  registration_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  sector: string;
  email: string;
  phone?: string;
  review_status?: string;
};
type Row = {
  id: string;
  status: AttendanceStatus;
  notes: string;
  checked_in_at?: string | null;
  marked_by?: string | null;
  marked_by_name?: string | null;
  registration_id: string;
  registrations: Person | Person[] | null;
};
type Sheet = {
  seeded: number;
  sheetStatus: string;
  kind: string;
  teamName: string;
  counts: { present: number; late: number; absent: number; excused: number; total: number };
};

type SheetTab = 'waiting' | 'checked_in';
type SearchHit = { person: Person; row: Row | null };
type AdminSession = { role: string; permissions: string[] };

function one<T>(value: T | T[] | null) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

function personMatches(person: Person, query: string) {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const haystack = normalizeSearchText(
    [
      person.first_name,
      person.middle_name,
      person.last_name,
      `${person.first_name || ''} ${person.last_name || ''}`,
      person.email,
      person.registration_id,
      person.sector,
      person.phone,
      (person.phone || '').replace(/\D+/g, ''),
    ]
      .filter(Boolean)
      .join(' '),
  );
  return q.split(/\s+/).every((token) => {
    if (!token) return true;
    if (haystack.includes(token)) return true;
    const digits = token.replace(/\D+/g, '');
    return Boolean(digits && haystack.includes(digits));
  });
}

function rowMatches(row: Row, query: string) {
  const person = one(row.registrations);
  if (!person) return !query.trim();
  return personMatches(person, query);
}

function shiftLabel(shift: Shift) {
  const cohort = one(shift.ops_cohorts);
  const team = one(shift.ops_teams ?? null);
  const time = `${String(shift.start_time).slice(0, 5)}–${String(shift.end_time).slice(0, 5)}`;
  const bits = [
    shift.is_floor_default ? '★ Floor default' : null,
    shift.name,
    shift.shift_date,
    time,
    shift.kind || 'training',
    shift.sheet_status || 'open',
    team?.name,
    cohort?.code,
  ].filter(Boolean);
  return bits.join(' · ');
}

function statusRank(status?: AttendanceStatus | null) {
  if (status === 'present') return 0;
  if (status === 'late') return 1;
  if (status === 'excused') return 2;
  if (status === 'absent') return 3;
  return 4;
}

function readStoredShiftId() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SHIFT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredShiftId(id: string) {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(SHIFT_STORAGE_KEY, id);
    else window.localStorage.removeItem(SHIFT_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

function readStoredBlockId() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(BLOCK_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredBlockId(id: string) {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(BLOCK_STORAGE_KEY, id);
    else window.localStorage.removeItem(BLOCK_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

function syncShiftInUrl(id: string, blockId?: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('shiftId', id);
  else url.searchParams.delete('shiftId');
  if (blockId && blockId !== UNGROUPED_BLOCK) url.searchParams.set('blockId', blockId);
  else if (blockId === UNGROUPED_BLOCK) url.searchParams.set('blockId', UNGROUPED_BLOCK);
  else url.searchParams.delete('blockId');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function pickPreferredBlockId(options: {
  blocks: Block[];
  shifts: Shift[];
  requestedId: string;
  defaultBlockId: string | null;
  shiftId: string;
}) {
  const { blocks, shifts, requestedId, defaultBlockId, shiftId } = options;
  if (requestedId === UNGROUPED_BLOCK) return UNGROUPED_BLOCK;
  if (requestedId && blocks.some((block) => block.id === requestedId)) return requestedId;

  const selectedShift = shifts.find((shift) => shift.id === shiftId);
  if (selectedShift?.block_id && blocks.some((block) => block.id === selectedShift.block_id)) {
    return selectedShift.block_id;
  }
  if (defaultBlockId && blocks.some((block) => block.id === defaultBlockId)) return defaultBlockId;
  const floor = blocks.find((block) => block.is_floor_default);
  if (floor) return floor.id;
  if (blocks[0]) return blocks[0].id;
  if (shifts.some((shift) => !shift.block_id)) return UNGROUPED_BLOCK;
  return '';
}

function isAttendanceOnlyRole(session: AdminSession | null) {
  if (!session || session.role === 'super_admin') return false;
  const canMark = hasCapability(session, 'attendance.mark');
  if (!canMark) return false;
  return !hasCapability(session, 'attendance.verify')
    && !hasCapability(session, 'attendance.reopen')
    && !hasCapability(session, 'attendance.default');
}

function pickPreferredShiftId(options: {
  shifts: Shift[];
  requestedId: string;
  defaultShiftId: string | null;
  attendanceOnly: boolean;
}) {
  const { shifts, requestedId, defaultShiftId, attendanceOnly } = options;
  if (!shifts.length) return '';

  const byId = new Map(shifts.map((shift) => [shift.id, shift]));
  const openShifts = shifts.filter((shift) => (shift.sheet_status || 'open') === 'open');
  const pool = attendanceOnly ? (openShifts.length ? openShifts : []) : shifts;

  if (requestedId && byId.has(requestedId)) {
    const requested = byId.get(requestedId)!;
    if (!attendanceOnly || (requested.sheet_status || 'open') === 'open') return requestedId;
  }

  if (defaultShiftId && pool.some((shift) => shift.id === defaultShiftId)) return defaultShiftId;

  const floorDefault = pool.find((shift) => shift.is_floor_default);
  if (floorDefault) return floorDefault.id;

  return pool[0]?.id || '';
}

function PresentBadge({ checkedInAt }: { checkedInAt?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
      Present
      {checkedInAt ? <span className="font-normal normal-case tracking-normal text-emerald-200/80">· {checkedInAt}</span> : null}
    </span>
  );
}

function LateBadge({ checkedInAt }: { checkedInAt?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
      Late
      {checkedInAt ? <span className="font-normal normal-case tracking-normal text-amber-200/80">· {checkedInAt}</span> : null}
    </span>
  );
}

function notePlaceholder(lastPresentAt?: string | null) {
  if (!lastPresentAt) return 'Optional note';
  const date = new Date(lastPresentAt);
  if (Number.isNaN(date.getTime())) return `Last present ${lastPresentAt}`;
  return `Last present ${date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function showMarkToast(options: {
  name: string;
  registrationId?: string;
  status: AttendanceStatus;
}) {
  const { name, registrationId, status } = options;
  const tone =
    status === 'present'
      ? 'border-emerald-500/50 bg-emerald-950 text-emerald-50'
      : status === 'late'
        ? 'border-amber-500/50 bg-amber-950 text-amber-50'
        : status === 'excused'
          ? 'border-sky-500/40 bg-sky-950 text-sky-50'
          : 'border-zinc-500/40 bg-zinc-900 text-zinc-50';

  toast.custom(
    (id) => (
      <div
        className={cn(
          'w-[min(92vw,24rem)] rounded-2xl border px-4 py-4 shadow-xl',
          tone,
        )}
        role="status"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Attendance updated</p>
        <p className="mt-1 text-lg font-semibold leading-snug">{name}</p>
        {registrationId ? <p className="mt-0.5 text-xs opacity-75">{registrationId}</p> : null}
        <p className="mt-3 text-sm">
          Marked as{' '}
          <span className="font-semibold capitalize">{status}</span>
        </p>
        <button
          type="button"
          className="mt-3 text-xs underline opacity-70 hover:opacity-100"
          onClick={() => toast.dismiss(id)}
        >
          Dismiss
        </button>
      </div>
    ),
    { duration: 4500 },
  );
}

function MarkButtons({
  currentStatus,
  locked,
  canMark = true,
  onMark,
  compact,
}: {
  currentStatus?: AttendanceStatus | null;
  locked: boolean;
  canMark?: boolean;
  onMark: (status: AttendanceStatus) => void;
  compact?: boolean;
}) {
  if (!canMark) return null;
  const alreadyPresent = currentStatus === 'present';
  return (
    <div className={cn('grid gap-1', compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}>
      {ATTENDANCE_STATUSES.map((status) => {
        const disabled = locked || (alreadyPresent && status !== 'absent');
        const activeTone =
          currentStatus === status
            ? status === 'late'
              ? 'border-amber-500/50 bg-amber-500/20 text-amber-100'
              : status === 'present'
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-100'
                : undefined
            : undefined;
        return (
          <Button
            key={status}
            size="sm"
            className={cn('w-full capitalize', activeTone)}
            variant={currentStatus === status ? 'default' : status === 'present' ? 'default' : compact ? 'outline' : 'ghost'}
            onClick={() => onMark(status)}
            disabled={disabled}
          >
            {status}
          </Button>
        );
      })}
    </div>
  );
}

function AttendanceDesk() {
  const searchParams = useSearchParams();
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allBlocks, setAllBlocks] = useState<Block[]>([]);
  const [defaultShiftId, setDefaultShiftId] = useState<string | null>(null);
  const [defaultBlockId, setDefaultBlockId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState(searchParams.get('blockId') || '');
  const [shiftId, setShiftId] = useState(searchParams.get('shiftId') || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SheetTab>('waiting');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all');
  const [notesByPerson, setNotesByPerson] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState<Person[]>([]);
  const [serverMatches, setServerMatches] = useState<Person[]>([]);
  const [lastPresentByPerson, setLastPresentByPerson] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const approvedLoaded = useRef(false);

  const attendanceOnly = isAttendanceOnlyRole(session);
  const canMark = session ? hasCapability(session, 'attendance.mark') : true;
  const canSeed = session ? hasCapability(session, 'attendance.mark') : false;
  const canSubmit = session ? hasCapability(session, 'attendance.submit') : false;
  const canVerify = session ? hasCapability(session, 'attendance.verify') : false;
  const canReopen = session ? hasCapability(session, 'attendance.reopen') : false;
  const canSetDefault = session
    ? session.role === 'super_admin' && hasCapability(session, 'attendance.default')
    : false;
  const canReports = session ? hasCapability(session, 'attendance.reports') : false;
  const isSuperAdmin = session?.role === 'super_admin';
  const hasSheetActions = canSeed || canSubmit || canVerify || canReopen || canSetDefault;

  function markerLabel(row?: Row | null) {
    if (!isSuperAdmin || !row) return null;
    if (row.status === 'absent') return null;
    if (!row.marked_by_name) return null;
    return row.marked_by_name;
  }

  const shiftsInBlock = useMemo(() => {
    if (!blockId) return allShifts;
    if (blockId === UNGROUPED_BLOCK) return allShifts.filter((shift) => !shift.block_id);
    return allShifts.filter((shift) => shift.block_id === blockId);
  }, [allShifts, blockId]);

  const shifts = useMemo(() => {
    const pool = shiftsInBlock;
    if (!attendanceOnly) return pool;
    const open = pool.filter((shift) => (shift.sheet_status || 'open') === 'open');
    if (open.length) {
      return [...open].sort((a, b) => Number(Boolean(b.is_floor_default)) - Number(Boolean(a.is_floor_default)));
    }
    return [];
  }, [shiftsInBlock, attendanceOnly]);

  const hasUngrouped = useMemo(
    () => allShifts.some((shift) => !shift.block_id),
    [allShifts],
  );

  async function loadShift(nextShiftId: string, nextBlockId = blockId) {
    const params = new URLSearchParams();
    if (nextShiftId) params.set('shiftId', nextShiftId);
    const payload = await adminFetch<{
      shifts: Shift[];
      blocks: Block[];
      rows: Row[];
      matches: Person[];
      sheet: Sheet | null;
      defaultShiftId?: string | null;
      defaultBlockId?: string | null;
      lastPresentByPerson?: Record<string, string>;
    }>(`/api/admin/attendance?${params}`);

    const nextShifts = payload.shifts ?? [];
    const nextBlocks = payload.blocks ?? [];
    setAllShifts(nextShifts);
    setAllBlocks(nextBlocks);
    setDefaultShiftId(payload.defaultShiftId ?? null);
    setDefaultBlockId(payload.defaultBlockId ?? null);
    setRows((payload.rows ?? []).filter((row) => {
      const person = one(row.registrations);
      return !person?.review_status || person.review_status === 'approved';
    }));
    setSheet(payload.sheet);
    setLastPresentByPerson(payload.lastPresentByPerson ?? {});

    const markerOnly = isAttendanceOnlyRole(session);
    const requestedBlock = nextBlockId || readStoredBlockId() || searchParams.get('blockId') || '';
    const preferredBlock = pickPreferredBlockId({
      blocks: nextBlocks,
      shifts: nextShifts,
      requestedId: requestedBlock,
      defaultBlockId: payload.defaultBlockId ?? null,
      shiftId: nextShiftId || readStoredShiftId() || '',
    });
    if (preferredBlock && preferredBlock !== nextBlockId) {
      setBlockId(preferredBlock);
      writeStoredBlockId(preferredBlock);
    } else if (preferredBlock) {
      writeStoredBlockId(preferredBlock);
    }

    const blockPool = preferredBlock === UNGROUPED_BLOCK
      ? nextShifts.filter((shift) => !shift.block_id)
      : preferredBlock
        ? nextShifts.filter((shift) => shift.block_id === preferredBlock)
        : nextShifts;

    const requestedId = nextShiftId || readStoredShiftId() || searchParams.get('shiftId') || '';
    const preferred = pickPreferredShiftId({
      shifts: blockPool.length ? blockPool : nextShifts,
      requestedId,
      defaultShiftId: payload.defaultShiftId ?? null,
      attendanceOnly: markerOnly,
    });

    const requested = nextShifts.find((shift) => shift.id === nextShiftId);
    const requestedClosedForMarkers = Boolean(
      markerOnly
      && requested
      && (requested.sheet_status || 'open') !== 'open',
    );
    const requestedOutsideBlock = Boolean(
      preferredBlock
      && requested
      && (
        preferredBlock === UNGROUPED_BLOCK
          ? Boolean(requested.block_id)
          : requested.block_id !== preferredBlock
      ),
    );
    const shouldSnapToPreferred = Boolean(
      preferred
      && preferred !== nextShiftId
      && (!nextShiftId || !requested || requestedClosedForMarkers || requestedOutsideBlock),
    );

    if (shouldSnapToPreferred && preferred) {
      setShiftId(preferred);
      writeStoredShiftId(preferred);
      syncShiftInUrl(preferred, preferredBlock);
    } else if (nextShiftId) {
      writeStoredShiftId(nextShiftId);
      syncShiftInUrl(nextShiftId, preferredBlock);
    }

    return preferred;
  }

  async function loadApprovedIndex() {
    if (approvedLoaded.current && approved.length) return;
    const payload = await adminFetch<{ matches: Person[] }>('/api/admin/attendance?mode=approved');
    setApproved(payload.matches ?? []);
    approvedLoaded.current = true;
  }

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

  useEffect(() => {
    if (bootstrapped) return;
    const urlShift = searchParams.get('shiftId') || '';
    const urlBlock = searchParams.get('blockId') || '';
    const storedShift = readStoredShiftId();
    const storedBlock = readStoredBlockId();
    setShiftId(urlShift || storedShift || '');
    setBlockId(urlBlock || storedBlock || '');
    setBootstrapped(true);
  }, [bootstrapped, searchParams]);

  useEffect(() => {
    if (!bootstrapped) return;
    loadShift(shiftId).catch((reason: Error) => setError(reason.message));
    // intentionally re-load when shiftId changes after bootstrap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, shiftId, session?.role]);

  useEffect(() => {
    loadApprovedIndex().catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setServerMatches([]);
      return;
    }
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set('q', q);
      if (shiftId) params.set('shiftId', shiftId);
      adminFetch<{ matches: Person[] }>(`/api/admin/attendance?${params}`)
        .then((payload) => setServerMatches(payload.matches ?? []))
        .catch(() => setServerMatches([]));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, shiftId]);

  const waitingRows = useMemo(
    () => rows.filter((row) => row.status === 'absent').filter((row) => rowMatches(row, query)),
    [rows, query],
  );
  const checkedInRows = useMemo(
    () => rows.filter((row) => row.status !== 'absent').filter((row) => rowMatches(row, query)),
    [rows, query],
  );

  const waitingCount = sheet?.counts
    ? sheet.counts.absent
    : rows.filter((row) => row.status === 'absent').length;
  const checkedInCount = sheet?.counts
    ? sheet.counts.present + sheet.counts.late + sheet.counts.excused
    : rows.filter((row) => row.status !== 'absent').length;

  const searchHits = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as SearchHit[];

    const onSheetById = new Map(rows.map((row) => [row.registration_id, row]));
    const fromSheet = rows
      .filter((row) => rowMatches(row, q))
      .map((row) => ({ person: one(row.registrations)!, row }))
      .filter((item) => item.person);

    const sheetIds = new Set(fromSheet.map((item) => item.person.id));
    const approvedPool = [...serverMatches, ...approved];
    const seen = new Set<string>();
    const fromApproved: SearchHit[] = [];
    for (const person of approvedPool) {
      if (seen.has(person.id) || sheetIds.has(person.id)) continue;
      if (!personMatches(person, q)) continue;
      if (sheet?.kind === 'ops' && !onSheetById.has(person.id)) continue;
      seen.add(person.id);
      fromApproved.push({ person, row: onSheetById.get(person.id) ?? null });
    }

    return [...fromSheet, ...fromApproved]
      .sort((a, b) => statusRank(a.row?.status) - statusRank(b.row?.status))
      .slice(0, 24);
  }, [approved, query, rows, serverMatches, sheet?.kind]);

  const searchHitIds = useMemo(() => new Set(searchHits.map((hit) => hit.person.id)), [searchHits]);

  const visibleRows = useMemo(() => {
    // While searching, only show the golden search block — avoid the same people reappearing below.
    if (query.trim()) return [];
    const base = tab === 'waiting' ? waitingRows : checkedInRows;
    const filtered = statusFilter === 'all' ? base : base.filter((row) => row.status === statusFilter);
    return filtered.filter((row) => {
      const person = one(row.registrations);
      return !person || !searchHitIds.has(person.id);
    });
  }, [tab, waitingRows, checkedInRows, statusFilter, query, searchHitIds]);

  const locked = sheet?.sheetStatus === 'verified'
    || (attendanceOnly && sheet?.sheetStatus === 'submitted');
  const selected = shifts.find((shift) => shift.id === shiftId) || allShifts.find((shift) => shift.id === shiftId);
  const selectedBlock = blockId === UNGROUPED_BLOCK
    ? null
    : allBlocks.find((block) => block.id === blockId) || null;
  const noOpenShiftForMarkers = attendanceOnly && shifts.length === 0;

  function selectBlock(nextId: string) {
    setBlockId(nextId);
    writeStoredBlockId(nextId);
    const pool = nextId === UNGROUPED_BLOCK
      ? allShifts.filter((shift) => !shift.block_id)
      : nextId
        ? allShifts.filter((shift) => shift.block_id === nextId)
        : allShifts;
    const markerOnly = attendanceOnly;
    const openPool = markerOnly
      ? pool.filter((shift) => (shift.sheet_status || 'open') === 'open')
      : pool;
    const preferred = pickPreferredShiftId({
      shifts: openPool.length ? openPool : pool,
      requestedId: '',
      defaultShiftId,
      attendanceOnly: markerOnly,
    });
    setShiftId(preferred);
    writeStoredShiftId(preferred);
    syncShiftInUrl(preferred, nextId);
    setTab('waiting');
    setQuery('');
    setIdentityId(null);
    setStatusFilter('all');
    setServerMatches([]);
  }

  function selectShift(nextId: string) {
    setShiftId(nextId);
    writeStoredShiftId(nextId);
    syncShiftInUrl(nextId, blockId);
    setTab('waiting');
    setQuery('');
    setIdentityId(null);
    setStatusFilter('all');
    setServerMatches([]);
  }

  async function setDefaultBlock() {
    if (!blockId || blockId === UNGROUPED_BLOCK) return;
    try {
      await adminFetch(`/api/admin/shifts/blocks/${blockId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'set_default' }),
      });
      toast.success('Floor default bulk block set. Attendance opens this sheet group first.');
      await loadShift(shiftId, blockId);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not set the default bulk block.');
    }
  }

  async function mark(registrationId: string, status: AttendanceStatus, person?: Person | null) {
    if (locked) {
      toast.error(
        sheet?.sheetStatus === 'submitted'
          ? 'Sheet is submitted. An admin must reopen it before floor staff can mark again.'
          : 'Sheet is verified. Reopen it before changing marks.',
      );
      return;
    }
    try {
      const notes = (notesByPerson[registrationId] || '').trim();
      const result = await adminFetch<{
        ok: boolean;
        status: AttendanceStatus;
        person?: { id: string; registration_id: string; name: string };
      }>('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({ shiftId, registrationId, status, notes }),
      });
      const name = result.person?.name
        || (person ? formatVolunteerName(person) : 'Volunteer');
      showMarkToast({
        name,
        registrationId: result.person?.registration_id || person?.registration_id,
        status: result.status || status,
      });
      setQuery('');
      setServerMatches([]);
      // Keep the same shift selected after mark — do not fall back to the first chronological shift.
      await loadShift(shiftId);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not mark attendance.');
    }
  }

  function formatCheckIn(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function sheetAction(action: 'submit' | 'verify' | 'reopen' | 'seed' | 'set_default') {
    if (!shiftId) return;
    try {
      await adminFetch(`/api/admin/shifts/${shiftId}/sheet`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      toast.success(
        action === 'submit' ? 'Sheet submitted.'
          : action === 'verify' ? 'Sheet verified.'
            : action === 'reopen' ? 'Sheet reopened.'
              : action === 'set_default' ? 'Floor default shift set. Attendance staff will open this sheet.'
                : 'Absent rows seeded.',
      );
      await loadShift(shiftId);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not update the sheet.');
    }
  }

  const counts = sheet?.counts
    ? ATTENDANCE_STATUSES.map((status) => ({ status, count: sheet.counts[status] ?? 0 }))
    : ATTENDANCE_STATUSES.map((status) => ({ status, count: rows.filter((row) => row.status === status).length }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          kicker="FLOOR"
          title="Attendance"
          description="Waiting tab stays on absents. After you mark present / late / excused they move to Checked in. Search works across the full approved list. Reports and export use verified sheets only."
        />
        {canReports ? (
          <Link href={href('/admin/attendance/reports')} className={cn(buttonVariants({ variant: 'outline' }), 'h-11 shrink-0')}>
            Reports & export
          </Link>
        ) : null}
      </div>
      <Banner message={error} />

      <div className="grid gap-2 rounded-2xl border border-[#e7c15a]/35 bg-[#e7c15a]/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 grid gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-[#e7c15a]">
                1 · Bulk sheet
              </label>
              <select
                className={cn(controlClass, 'mt-1 h-11 border-white/15 bg-black/40')}
                value={blockId}
                onChange={(event) => selectBlock(event.target.value)}
                disabled={allBlocks.length === 0 && !hasUngrouped}
              >
                {allBlocks.length === 0 && !hasUngrouped ? (
                  <option value="">No bulk blocks yet</option>
                ) : null}
                {allBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {(block.is_floor_default || block.id === defaultBlockId) ? '★ ' : ''}
                    {block.name} · {block.start_date} → {block.end_date}
                  </option>
                ))}
                {hasUngrouped ? (
                  <option value={UNGROUPED_BLOCK}>Ungrouped shifts</option>
                ) : null}
              </select>
              {selectedBlock ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedBlock.kind} · {selectedBlock.location || 'No location'}
                  {selectedBlock.is_floor_default || selectedBlock.id === defaultBlockId ? ' · floor default bulk' : ''}
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-[#e7c15a]">
                {attendanceOnly ? '2 · Open floor shift' : '2 · Specific shift'}
              </label>
              <select
                className={cn(controlClass, 'mt-1 h-11 border-white/15 bg-black/40')}
                value={shiftId}
                onChange={(event) => selectShift(event.target.value)}
                disabled={shifts.length === 0}
              >
                {shifts.length === 0 ? (
                  <option value="">
                    {noOpenShiftForMarkers ? 'No open shift — wait for an admin' : 'No shifts in this bulk sheet'}
                  </option>
                ) : null}
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shiftLabel(shift)}
                  </option>
                ))}
              </select>
              {selected ? (
                <p className="mt-1 text-xs text-zinc-500">
                  sheet {sheet?.sheetStatus || selected.sheet_status || 'open'}
                  {' · '}capacity {selected.capacity || 'not set'}
                  {sheet?.seeded ? ` · seeded ${sheet.seeded}` : ''}
                  {sheet?.teamName ? ` · ${sheet.teamName}` : ''}
                  {selected.is_floor_default || selected.id === defaultShiftId ? ' · floor default shift' : ''}
                </p>
              ) : null}
            </div>
            {attendanceOnly && locked ? (
              <p className="mt-2 text-sm text-amber-300">
                This sheet is {sheet?.sheetStatus}. Marking is blocked until an admin reopens it.
              </p>
            ) : null}
            {noOpenShiftForMarkers ? (
              <p className="mt-2 text-sm text-amber-300">
                There is no open attendance sheet right now. A superadmin must open or set the floor default shift.
              </p>
            ) : null}
          </div>

          {selected && hasSheetActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Sheet settings"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'icon' }),
                  'shrink-0 border-white/15 bg-black/35 text-zinc-200 hover:bg-white/10',
                )}
              >
                <Settings2 className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48 border-white/10 bg-zinc-950 text-zinc-100">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-zinc-400">Sheet actions</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {canSeed ? (
                    <DropdownMenuItem
                      disabled={sheet?.sheetStatus === 'verified'}
                      onClick={() => void sheetAction('seed')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Seed absent list
                    </DropdownMenuItem>
                  ) : null}
                  {canSubmit ? (
                    <DropdownMenuItem
                      disabled={sheet?.sheetStatus === 'verified' || sheet?.sheetStatus === 'submitted'}
                      onClick={() => void sheetAction('submit')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Submit sheet
                    </DropdownMenuItem>
                  ) : null}
                  {canVerify ? (
                    <DropdownMenuItem
                      disabled={sheet?.sheetStatus === 'verified'}
                      onClick={() => void sheetAction('verify')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Verify (admin)
                    </DropdownMenuItem>
                  ) : null}
                  {canReopen ? (
                    <DropdownMenuItem
                      disabled={sheet?.sheetStatus === 'open'}
                      onClick={() => void sheetAction('reopen')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Reopen
                    </DropdownMenuItem>
                  ) : null}
                  {canSetDefault && blockId && blockId !== UNGROUPED_BLOCK ? (
                    <DropdownMenuItem
                      disabled={Boolean(selectedBlock?.is_floor_default || selectedBlock?.id === defaultBlockId)}
                      onClick={() => void setDefaultBlock()}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Set bulk as floor default
                    </DropdownMenuItem>
                  ) : null}
                  {canSetDefault ? (
                    <DropdownMenuItem
                      disabled={Boolean(selected.is_floor_default)}
                      onClick={() => void sheetAction('set_default')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Set shift as floor default
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {counts.map((item) => (
            <div
              key={item.status}
              className={cn(
                'rounded-xl border px-2 py-2 text-center',
                item.status === 'late'
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : item.status === 'present'
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-white/10 bg-black/30',
              )}
            >
              <p className={cn(
                'text-[10px] uppercase tracking-wide',
                item.status === 'late' ? 'text-amber-300' : 'text-zinc-500',
              )}
              >
                {item.status}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      <PinBelowHeader
        pinId="attendance-toolbar"
        className="grid gap-2 rounded-2xl border border-white/10 bg-[rgba(8,8,10,0.98)] px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <input
            className={controlClass}
            value={query}
            placeholder="Search all approved: name · ID · phone"
            onChange={(event) => setQuery(event.target.value)}
            disabled={!shiftId || locked}
          />
          <select
            className={cn(controlClass, 'h-11 capitalize sm:w-40')}
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value as AttendanceStatus | 'all';
              setStatusFilter(value);
              if (value === 'absent') setTab('waiting');
              else if (value !== 'all') setTab('checked_in');
            }}
            disabled={!shiftId || Boolean(query.trim())}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {ATTENDANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1">
          <button
            type="button"
            onClick={() => { setTab('waiting'); setStatusFilter('all'); }}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${tab === 'waiting' ? 'bg-[#e7c15a]/15 text-[#e7c15a]' : 'text-zinc-300 hover:bg-white/5'}`}
          >
            Waiting · {waitingCount}
          </button>
          <button
            type="button"
            onClick={() => { setTab('checked_in'); setStatusFilter('all'); }}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${tab === 'checked_in' ? 'bg-[#e7c15a]/15 text-[#e7c15a]' : 'text-zinc-300 hover:bg-white/5'}`}
          >
            Checked in · {checkedInCount}
          </button>
        </div>
      </PinBelowHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <Card className="overflow-visible">
          <CardContent className="grid gap-4 pt-6">
            {query.trim() && searchHits.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-xs uppercase tracking-wide text-[#e7c15a]">Search results</p>
                {searchHits.map(({ person, row }) => {
                  const alreadyPresent = row?.status === 'present';
                  const isLate = row?.status === 'late';
                  const checkIn = formatCheckIn(row?.checked_in_at);
                  const lastPresent = lastPresentByPerson[person.id] || row?.checked_in_at || null;
                  const markedBy = markerLabel(row);
                  return (
                    <div
                      key={person.id}
                      className={cn(
                        'grid gap-2 rounded-2xl border px-3 py-3',
                        alreadyPresent
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : isLate
                            ? 'border-amber-500/40 bg-amber-500/10'
                            : identityId === person.id
                              ? 'border-[#e7c15a]/60 bg-[#e7c15a]/10'
                              : 'border-[#e7c15a]/30 bg-[#e7c15a]/5',
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 rounded-xl text-left transition hover:bg-white/5"
                        onClick={() => setIdentityId(person.id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm text-white">{formatVolunteerName(person)}</p>
                          {alreadyPresent ? <PresentBadge checkedInAt={checkIn} /> : null}
                          {isLate ? <LateBadge checkedInAt={checkIn} /> : null}
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {person.registration_id} · {person.sector}
                          {row && !alreadyPresent && !isLate ? ` · ${row.status}` : null}
                          {!row ? ' · not on sheet yet' : null}
                          {row?.checked_in_at && !alreadyPresent && !isLate ? ` · in ${checkIn}` : ''}
                          <span className="ml-1 text-[#e7c15a]">· tap for ID</span>
                        </p>
                        {markedBy ? (
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Marked by <span className="text-zinc-300">{markedBy}</span>
                          </p>
                        ) : null}
                      </button>
                      {alreadyPresent ? (
                        <p className="text-xs text-emerald-300/90">
                          Already presented for this shift. Only Absent can change this mark.
                        </p>
                      ) : (
                        <input
                          className={controlClass}
                          value={notesByPerson[person.id] ?? row?.notes ?? ''}
                          placeholder={notePlaceholder(lastPresent)}
                          disabled={locked}
                          onChange={(event) => setNotesByPerson((current) => ({ ...current, [person.id]: event.target.value }))}
                        />
                      )}
                      <MarkButtons
                        currentStatus={row?.status}
                        locked={locked}
                        canMark={canMark}
                        compact
                        onMark={(status) => void mark(person.id, status, person)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : query.trim() ? (
              <p className="text-sm text-zinc-400">No approved matches for that search{sheet?.kind === 'ops' ? ' on this team' : ''}.</p>
            ) : null}

            {!query.trim() ? (
              <div className="grid gap-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {tab === 'waiting' ? 'Still absent' : 'Present · late · excused'}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleRows.map((row) => {
                    const person = one(row.registrations);
                    const selectedPerson = Boolean(person && identityId === person.id);
                    const alreadyPresent = row.status === 'present';
                    const isLate = row.status === 'late';
                    const checkIn = formatCheckIn(row.checked_in_at);
                    const lastPresent = person
                      ? lastPresentByPerson[person.id] || row.checked_in_at || null
                      : row.checked_in_at || null;
                    const markedBy = markerLabel(row);
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          'grid gap-2 rounded-2xl border px-3 py-3',
                          alreadyPresent
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : isLate
                              ? 'border-amber-500/40 bg-amber-500/10'
                              : selectedPerson
                                ? 'border-[#e7c15a]/50 bg-[#e7c15a]/10'
                                : 'border-white/10 bg-black/25',
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 rounded-xl text-left transition hover:bg-white/5 disabled:cursor-default"
                          disabled={!person}
                          onClick={() => person && setIdentityId(person.id)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">{person ? formatVolunteerName(person) : 'Volunteer'}</p>
                            {alreadyPresent ? <PresentBadge checkedInAt={checkIn} /> : null}
                            {isLate ? <LateBadge checkedInAt={checkIn} /> : null}
                          </div>
                          <p className="mt-1 text-xs text-zinc-400">
                            {person?.registration_id} · {person?.sector}
                            {!alreadyPresent && !isLate ? ` · ${row.status}` : null}
                            {row.checked_in_at && !alreadyPresent && !isLate ? ` · in ${checkIn}` : ''}
                            {row.notes ? ` · note: ${row.notes}` : ''}
                            {person ? <span className="ml-1 text-[#e7c15a]">· tap for ID</span> : null}
                          </p>
                          {markedBy ? (
                            <p className="mt-1 text-[11px] text-zinc-500">
                              Marked by <span className="text-zinc-300">{markedBy}</span>
                            </p>
                          ) : null}
                        </button>
                        {alreadyPresent ? (
                          <p className="text-xs text-emerald-300/90">
                            Already presented. Only Absent can change this mark.
                          </p>
                        ) : person ? (
                          <input
                            className={controlClass}
                            value={notesByPerson[person.id] ?? row.notes ?? ''}
                            placeholder={notePlaceholder(lastPresent)}
                            disabled={locked}
                            onChange={(event) => setNotesByPerson((current) => ({ ...current, [person.id]: event.target.value }))}
                          />
                        ) : null}
                        <MarkButtons
                          currentStatus={row.status}
                          locked={locked}
                          canMark={canMark}
                          onMark={(status) => void mark(row.registration_id, status, person)}
                        />
                      </div>
                    );
                  })}
                </div>
                {shiftId && visibleRows.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    {tab === 'waiting' ? 'Nobody left waiting — everyone is checked in or the sheet is empty.' : 'Nobody checked in yet.'}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <AttendanceIdentityPanel
          volunteerId={identityId}
          onClose={() => setIdentityId(null)}
        />
      </div>

      <AttendanceIdentitySheet
        volunteerId={identityId}
        open={Boolean(identityId)}
        onOpenChange={(open) => {
          if (!open) setIdentityId(null);
        }}
      />
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<CphiaLoader fullscreen size="lg" label="Loading attendance" />}>
      <AttendanceDesk />
    </Suspense>
  );
}
