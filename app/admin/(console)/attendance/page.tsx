'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { formatVolunteerName } from '@/app/lib/admin/types';
import { Banner, controlClass, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Shift = {
  id: string;
  name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: number;
  ops_cohorts: { name: string; code: string } | { name: string; code: string }[] | null;
};
type Person = {
  id: string;
  registration_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  sector: string;
  email: string;
};
type Row = {
  id: string;
  status: AttendanceStatus;
  notes: string;
  registration_id: string;
  registrations: Person | Person[] | null;
};

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
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export default function AttendancePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftId, setShiftId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [approved, setApproved] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const approvedLoaded = useRef(false);

  async function loadShift(nextShiftId: string) {
    const params = new URLSearchParams();
    if (nextShiftId) params.set('shiftId', nextShiftId);
    const payload = await adminFetch<{ shifts: Shift[]; rows: Row[]; matches: Person[] }>(`/api/admin/attendance?${params}`);
    setShifts(payload.shifts);
    setRows(payload.rows);
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

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return approved.filter((person) => personMatches(person, q)).slice(0, 12);
  }, [approved, query]);

  async function mark(registrationId: string, status: AttendanceStatus) {
    try {
      await adminFetch('/api/admin/attendance', { method: 'POST', body: JSON.stringify({ shiftId, registrationId, status }) });
      setQuery('');
      await loadShift(shiftId);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not mark attendance.');
    }
  }

  const selected = shifts.find((shift) => shift.id === shiftId);
  const counts = ATTENDANCE_STATUSES.map((status) => ({ status, count: rows.filter((row) => row.status === status).length }));

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="FLOOR"
        title="Attendance"
        description="Only approved volunteers appear here. Search uses the cached approved list for instant results."
      />
      <Banner message={error} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle>Shifts</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {shifts.map((shift) => {
              const cohort = one(shift.ops_cohorts);
              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => setShiftId(shift.id)}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm ${shift.id === shiftId ? 'border-[#e7c15a]/50 bg-[#e7c15a]/10' : 'border-white/10 bg-black/25'}`}
                >
                  <p className="font-medium text-white">{shift.name}</p>
                  <p className="text-xs text-zinc-400">{shift.shift_date} · {String(shift.start_time).slice(0, 5)}–{String(shift.end_time).slice(0, 5)}</p>
                  <p className="text-xs text-zinc-500">{cohort?.code || 'Cohort'} · {shift.location || 'No location'}</p>
                </button>
              );
            })}
            {shifts.length === 0 ? <p className="text-sm text-zinc-400">No shifts yet. Create one under Shifts.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{selected ? selected.name : 'Select a shift'}</CardTitle>
            {selected ? <p className="text-sm text-zinc-400">Capacity {selected.capacity || 'not set'} · {approved.length} approved volunteers loaded</p> : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {counts.map((item) => (
                <span key={item.status} className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-zinc-300">{item.status} {item.count}</span>
              ))}
            </div>
            <input
              className={controlClass}
              value={query}
              placeholder="Search approved volunteers: name · father · grandfather, email, or ID"
              onChange={(event) => setQuery(event.target.value)}
              disabled={!shiftId}
            />
            {matches.length > 0 ? (
              <div className="grid gap-2">
                {matches.map((person) => (
                  <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 px-3 py-2">
                    <div>
                      <p className="text-sm text-white">{formatVolunteerName(person)}</p>
                      <p className="text-xs text-zinc-400">{person.registration_id} · {person.sector}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ATTENDANCE_STATUSES.map((status) => (
                        <Button key={status} size="sm" variant="outline" onClick={() => void mark(person.id, status)}>{status}</Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : query.trim() ? (
              <p className="text-sm text-zinc-400">No approved volunteers match that search.</p>
            ) : null}
            <div className="grid gap-2">
              {rows.map((row) => {
                const person = one(row.registrations);
                return (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{person ? formatVolunteerName(person) : 'Volunteer'}</p>
                      <p className="text-xs text-zinc-400">{person?.registration_id} · {person?.sector}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ATTENDANCE_STATUSES.map((status) => (
                        <Button key={status} size="sm" variant={row.status === status ? 'default' : 'ghost'} onClick={() => void mark(row.registration_id, status)}>{status}</Button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {shiftId && rows.length === 0 ? <p className="text-sm text-zinc-400">Nobody approved is marked on this shift yet.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
