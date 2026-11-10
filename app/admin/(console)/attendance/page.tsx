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
  sheet_status?: string;
  ops_cohorts: { name: string; code: string } | { name: string; code: string }[] | null;
  ops_teams?: { name: string; code: string } | { name: string; code: string }[] | null;
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
};
type Row = {
  id: string;
  status: AttendanceStatus;
  notes: string;
  checked_in_at?: string | null;
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

function one<T>(value: T | T[] | null) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function personMatches(person: Person, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    person.first_name,
    person.middle_name,
    person.last_name,
    person.email,
    person.registration_id,
    person.sector,
    person.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
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
    shift.name,
    shift.shift_date,
    time,
    shift.kind || 'training',
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

function PresentBadge({ checkedInAt }: { checkedInAt?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
      Present
      {checkedInAt ? <span className="font-normal normal-case tracking-normal text-emerald-200/80">· {checkedInAt}</span> : null}
    </span>
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
        return (
          <Button
            key={status}
            size="sm"
            className="w-full capitalize"
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
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftId, setShiftId] = useState(searchParams.get('shiftId') || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SheetTab>('waiting');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all');
  const [notesByPerson, setNotesByPerson] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [session, setSession] = useState<{ role: string; permissions: string[] } | null>(null);
  const approvedLoaded = useRef(false);

  async function loadShift(nextShiftId: string) {
    const params = new URLSearchParams();
    if (nextShiftId) params.set('shiftId', nextShiftId);
    const payload = await adminFetch<{ shifts: Shift[]; rows: Row[]; matches: Person[]; sheet: Sheet | null }>(`/api/admin/attendance?${params}`);
    setShifts(payload.shifts);
    setRows(payload.rows);
    setSheet(payload.sheet);
    if (!nextShiftId && payload.shifts[0]) setShiftId(payload.shifts[0].id);
  }

  async function loadApprovedIndex() {
    if (approvedLoaded.current && approved.length) return;
    const payload = await adminFetch<{ matches: Person[] }>('/api/admin/attendance?mode=approved');
    setApproved(payload.matches ?? []);
    approvedLoaded.current = true;
  }

  useEffect(() => {
    loadShift(shiftId).catch((reason: Error) => setError(reason.message));
  }, [shiftId]);

  useEffect(() => {
    loadApprovedIndex().catch((reason: Error) => setError(reason.message));
  }, []);

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

  const visibleRows = useMemo(() => {
    const base = tab === 'waiting' ? waitingRows : checkedInRows;
    if (statusFilter === 'all') return base;
    return base.filter((row) => row.status === statusFilter);
  }, [tab, waitingRows, checkedInRows, statusFilter]);

  const searchHits = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as SearchHit[];

    const onSheetById = new Map(rows.map((row) => [row.registration_id, row]));
    const fromSheet = rows
      .filter((row) => rowMatches(row, q))
      .map((row) => ({ person: one(row.registrations)!, row }))
      .filter((item) => item.person);

    const sheetIds = new Set(fromSheet.map((item) => item.person.id));
    const fromApproved = approved
      .filter((person) => personMatches(person, q))
      .filter((person) => sheet?.kind !== 'ops' || onSheetById.has(person.id))
      .filter((person) => !sheetIds.has(person.id))
      .map((person) => ({ person, row: onSheetById.get(person.id) ?? null }));

    return [...fromSheet, ...fromApproved]
      .sort((a, b) => statusRank(a.row?.status) - statusRank(b.row?.status))
      .slice(0, 16);
  }, [approved, query, rows, sheet?.kind]);

  const locked = sheet?.sheetStatus === 'verified';
  const selected = shifts.find((shift) => shift.id === shiftId);
  const canMark = session ? hasCapability(session, 'attendance.mark') : true;
  const canSeed = session ? hasCapability(session, 'attendance.mark') : false;
  const canSubmit = session ? hasCapability(session, 'attendance.submit') : false;
  const canVerify = session ? hasCapability(session, 'attendance.verify') : false;
  const canReopen = session ? hasCapability(session, 'attendance.reopen') : false;
  const canReports = session ? hasCapability(session, 'attendance.reports') : false;
  const hasSheetActions = canSeed || canSubmit || canVerify || canReopen;

  function selectShift(nextId: string) {
    setShiftId(nextId);
    setTab('waiting');
    setQuery('');
    setIdentityId(null);
    setStatusFilter('all');
  }

  async function mark(registrationId: string, status: AttendanceStatus) {
    if (locked) {
      toast.error('Sheet is verified. Reopen it before changing marks.');
      return;
    }
    try {
      const notes = (notesByPerson[registrationId] || '').trim();
      await adminFetch('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({ shiftId, registrationId, status, notes }),
      });
      setQuery('');
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

  async function sheetAction(action: 'submit' | 'verify' | 'reopen' | 'seed') {
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
          description="Waiting tab stays on absents. After you mark present / late / excused they move to Checked in. Search works on both. Reports and export use verified sheets only."
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
          <div className="min-w-0 flex-1">
            <label className="text-[11px] uppercase tracking-wide text-[#e7c15a]">Selected shift</label>
            <select
              className={cn(controlClass, 'mt-1 h-11 border-white/15 bg-black/40')}
              value={shiftId}
              onChange={(event) => selectShift(event.target.value)}
              disabled={shifts.length === 0}
            >
              {shifts.length === 0 ? <option value="">No shifts yet</option> : null}
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
                      disabled={locked}
                      onClick={() => void sheetAction('seed')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Seed absent list
                    </DropdownMenuItem>
                  ) : null}
                  {canSubmit ? (
                    <DropdownMenuItem
                      disabled={locked || sheet?.sheetStatus === 'submitted'}
                      onClick={() => void sheetAction('submit')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Submit sheet
                    </DropdownMenuItem>
                  ) : null}
                  {canVerify ? (
                    <DropdownMenuItem
                      disabled={locked}
                      onClick={() => void sheetAction('verify')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Verify (admin)
                    </DropdownMenuItem>
                  ) : null}
                  {canReopen ? (
                    <DropdownMenuItem
                      disabled={!locked && sheet?.sheetStatus === 'open'}
                      onClick={() => void sheetAction('reopen')}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      Reopen
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
              className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{item.status}</p>
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
            placeholder="Search both tabs: name · ID · phone"
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
            disabled={!shiftId}
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
                  const checkIn = formatCheckIn(row?.checked_in_at);
                  return (
                    <div
                      key={person.id}
                      className={cn(
                        'grid gap-2 rounded-2xl border px-3 py-3',
                        alreadyPresent
                          ? 'border-emerald-500/40 bg-emerald-500/10'
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
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {person.registration_id} · {person.sector}
                          {row && !alreadyPresent ? ` · ${row.status}` : null}
                          {!row ? ' · not on sheet yet' : null}
                          {row?.checked_in_at && !alreadyPresent ? ` · in ${checkIn}` : ''}
                          <span className="ml-1 text-[#e7c15a]">· tap for ID</span>
                        </p>
                      </button>
                      {alreadyPresent ? (
                        <p className="text-xs text-emerald-300/90">
                          Already presented for this shift. Only Absent can change this mark.
                        </p>
                      ) : (
                        <input
                          className={controlClass}
                          value={notesByPerson[person.id] ?? row?.notes ?? ''}
                          placeholder="Optional note for this mark"
                          disabled={locked}
                          onChange={(event) => setNotesByPerson((current) => ({ ...current, [person.id]: event.target.value }))}
                        />
                      )}
                      <MarkButtons
                        currentStatus={row?.status}
                        locked={locked}
                        canMark={canMark}
                        compact
                        onMark={(status) => void mark(person.id, status)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : query.trim() ? (
              <p className="text-sm text-zinc-400">No matches on this sheet{sheet?.kind === 'ops' ? ' / team' : ''}.</p>
            ) : null}

            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {tab === 'waiting' ? 'Still absent' : 'Present · late · excused'}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleRows.map((row) => {
                  const person = one(row.registrations);
                  const selectedPerson = Boolean(person && identityId === person.id);
                  const alreadyPresent = row.status === 'present';
                  const checkIn = formatCheckIn(row.checked_in_at);
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'grid gap-2 rounded-2xl border px-3 py-3',
                        alreadyPresent
                          ? 'border-emerald-500/40 bg-emerald-500/10'
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
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {person?.registration_id} · {person?.sector}
                          {!alreadyPresent ? ` · ${row.status}` : null}
                          {row.checked_in_at && !alreadyPresent ? ` · in ${checkIn}` : ''}
                          {row.notes ? ` · note: ${row.notes}` : ''}
                          {person ? <span className="ml-1 text-[#e7c15a]">· tap for ID</span> : null}
                        </p>
                      </button>
                      {alreadyPresent ? (
                        <p className="text-xs text-emerald-300/90">
                          Already presented. Only Absent can change this mark.
                        </p>
                      ) : person ? (
                        <input
                          className={controlClass}
                          value={notesByPerson[person.id] ?? row.notes ?? ''}
                          placeholder="Optional note for this mark"
                          disabled={locked}
                          onChange={(event) => setNotesByPerson((current) => ({ ...current, [person.id]: event.target.value }))}
                        />
                      ) : null}
                      <MarkButtons
                        currentStatus={row.status}
                        locked={locked}
                        canMark={canMark}
                        onMark={(status) => void mark(row.registration_id, status)}
                      />
                    </div>
                  );
                })}
              </div>
              {shiftId && visibleRows.length === 0 && !query.trim() ? (
                <p className="text-sm text-zinc-400">
                  {tab === 'waiting' ? 'Nobody left waiting — everyone is checked in or the sheet is empty.' : 'Nobody checked in yet.'}
                </p>
              ) : null}
              {shiftId && visibleRows.length === 0 && query.trim() ? (
                <p className="text-sm text-zinc-400">No one on this tab matches that search. Check the search results above or the other tab.</p>
              ) : null}
            </div>
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
