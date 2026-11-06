'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
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
type Person = { id: string; registration_id: string; first_name: string; last_name: string; sector: string; email: string };
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

export default function AttendancePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftId, setShiftId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(nextShiftId: string, search: string) {
    const params = new URLSearchParams();
    if (nextShiftId) params.set('shiftId', nextShiftId);
    if (search) params.set('q', search);
    const payload = await adminFetch<{ shifts: Shift[]; rows: Row[]; matches: Person[] }>(`/api/admin/attendance?${params}`);
    setShifts(payload.shifts);
    setRows(payload.rows);
    setMatches(payload.matches);
    if (!nextShiftId && payload.shifts[0]) setShiftId(payload.shifts[0].id);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(shiftId, query).catch((reason: Error) => setError(reason.message));
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [shiftId, query]);

  async function mark(registrationId: string, status: AttendanceStatus) {
    try {
      await adminFetch('/api/admin/attendance', { method: 'POST', body: JSON.stringify({ shiftId, registrationId, status }) });
      setQuery('');
      await load(shiftId, '');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not mark attendance.');
    }
  }

  const selected = shifts.find((shift) => shift.id === shiftId);
  const counts = ATTENDANCE_STATUSES.map((status) => ({ status, count: rows.filter((row) => row.status === status).length }));

  return (
    <div className="grid gap-6">
      <PageHeader kicker="FLOOR" title="Attendance" description="Pick a shift, find a volunteer, and mark how they showed up." />
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
            {selected ? <p className="text-sm text-zinc-400">Capacity {selected.capacity || 'not set'}</p> : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {counts.map((item) => (
                <span key={item.status} className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-zinc-300">{item.status} {item.count}</span>
              ))}
            </div>
            <input className={controlClass} value={query} placeholder="Search name, email, or registration ID" onChange={(event) => setQuery(event.target.value)} />
            {matches.length > 0 ? (
              <div className="grid gap-2">
                {matches.map((person) => (
                  <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 px-3 py-2">
                    <div>
                      <p className="text-sm text-white">{person.first_name} {person.last_name}</p>
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
            ) : null}
            <div className="grid gap-2">
              {rows.map((row) => {
                const person = one(row.registrations);
                return (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{person ? `${person.first_name} ${person.last_name}` : 'Volunteer'}</p>
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
              {shiftId && rows.length === 0 ? <p className="text-sm text-zinc-400">Nobody is marked on this shift yet.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
