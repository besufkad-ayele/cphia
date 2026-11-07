'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { formatVolunteerName } from '@/app/lib/admin/types';
import { Banner, controlClass, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

function AttendanceDesk() {
  const searchParams = useSearchParams();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftId, setShiftId] = useState(searchParams.get('shiftId') || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SheetTab>('waiting');
  const [approved, setApproved] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  const visibleRows = tab === 'waiting' ? waitingRows : checkedInRows;

  const searchHits = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as Array<{ person: Person; row: Row | null }>;

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

    return [...fromSheet, ...fromApproved].slice(0, 16);
  }, [approved, query, rows, sheet?.kind]);

  const locked = sheet?.sheetStatus === 'verified';
  const selected = shifts.find((shift) => shift.id === shiftId);

  async function mark(registrationId: string, status: AttendanceStatus) {
    if (locked) {
      toast.error('Sheet is verified. Reopen it before changing marks.');
      return;
    }
    try {
      await adminFetch('/api/admin/attendance', { method: 'POST', body: JSON.stringify({ shiftId, registrationId, status }) });
      if (status !== 'absent') setTab('checked_in');
      else setTab('waiting');
      setQuery('');
      await loadShift(shiftId);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not mark attendance.');
    }
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
      <PageHeader
        kicker="FLOOR"
        title="Attendance"
        description="Waiting tab stays on absents. After you mark present / late / excused they move to Checked in. Search works on both."
      />
      <Banner message={error} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle>Shifts</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {shifts.map((shift) => {
              const cohort = one(shift.ops_cohorts);
              const team = one(shift.ops_teams ?? null);
              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => { setShiftId(shift.id); setTab('waiting'); setQuery(''); }}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm ${shift.id === shiftId ? 'border-[#e7c15a]/50 bg-[#e7c15a]/10' : 'border-white/10 bg-black/25'}`}
                >
                  <p className="font-medium text-white">{shift.name}</p>
                  <p className="text-xs text-zinc-400">{shift.shift_date} · {String(shift.start_time).slice(0, 5)}–{String(shift.end_time).slice(0, 5)}</p>
                  <p className="text-xs text-zinc-500">
                    {shift.kind || 'training'}{team ? ` · ${team.name}` : ''} · {cohort?.code || 'Cohort'} · {shift.sheet_status || 'open'}
                  </p>
                </button>
              );
            })}
            {shifts.length === 0 ? <p className="text-sm text-zinc-400">No shifts yet. Create one under Shifts.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{selected ? selected.name : 'Select a shift'}</CardTitle>
            {selected ? (
              <p className="text-sm text-zinc-400">
                {sheet?.kind || selected.kind || 'training'}
                {sheet?.teamName ? ` · ${sheet.teamName}` : ''}
                {' · '}sheet {sheet?.sheetStatus || selected.sheet_status || 'open'}
                {' · '}capacity {selected.capacity || 'not set'}
                {sheet?.seeded ? ` · seeded ${sheet.seeded} absent` : ''}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            {selected ? (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => void sheetAction('seed')} disabled={locked}>Seed absent list</Button>
                <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => void sheetAction('submit')} disabled={locked || sheet?.sheetStatus === 'submitted'}>Submit sheet</Button>
                <Button size="sm" className="w-full sm:w-auto" onClick={() => void sheetAction('verify')} disabled={locked}>Verify (admin)</Button>
                <Button size="sm" className="w-full sm:w-auto" variant="ghost" onClick={() => void sheetAction('reopen')} disabled={!locked && sheet?.sheetStatus === 'open'}>Reopen</Button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              {counts.map((item) => (
                <span key={item.status} className="rounded-full border border-white/10 px-3 py-1 capitalize">
                  {item.status} {item.count}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setTab('waiting')}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'waiting' ? 'bg-[#e7c15a]/15 text-[#e7c15a]' : 'text-zinc-300 hover:bg-white/5'}`}
              >
                Waiting · {waitingCount}
              </button>
              <button
                type="button"
                onClick={() => setTab('checked_in')}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'checked_in' ? 'bg-[#e7c15a]/15 text-[#e7c15a]' : 'text-zinc-300 hover:bg-white/5'}`}
              >
                Checked in · {checkedInCount}
              </button>
            </div>

            <input
              className={controlClass}
              value={query}
              placeholder="Search both tabs: name · ID · phone"
              onChange={(event) => setQuery(event.target.value)}
              disabled={!shiftId || locked}
            />

            {query.trim() && searchHits.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-xs uppercase tracking-wide text-[#e7c15a]">Search results</p>
                {searchHits.map(({ person, row }) => (
                  <div key={person.id} className="grid gap-2 rounded-2xl border border-[#e7c15a]/30 bg-[#e7c15a]/5 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{formatVolunteerName(person)}</p>
                      <p className="text-xs text-zinc-400">
                        {person.registration_id} · {person.sector}
                        {row ? ` · ${row.status}` : ' · not on sheet yet'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                      {ATTENDANCE_STATUSES.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          className="w-full capitalize"
                          variant={row?.status === status ? 'default' : status === 'present' ? 'default' : 'outline'}
                          onClick={() => void mark(person.id, status)}
                          disabled={locked}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
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
                return (
                  <div key={row.id} className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{person ? formatVolunteerName(person) : 'Volunteer'}</p>
                      <p className="text-xs text-zinc-400">{person?.registration_id} · {person?.sector} · {row.status}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {ATTENDANCE_STATUSES.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          className="w-full capitalize"
                          variant={row.status === status ? 'default' : 'ghost'}
                          onClick={() => void mark(row.registration_id, status)}
                          disabled={locked}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
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
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AttendanceDesk />
    </Suspense>
  );
}
