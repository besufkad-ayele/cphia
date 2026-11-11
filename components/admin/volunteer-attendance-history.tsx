'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type AttendanceRow = {
  id: string;
  status: AttendanceStatus | string;
  notes: string;
  checkedInAt: string | null;
  shiftId: string;
  shiftName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  period?: 'morning' | 'afternoon' | string;
  periodLabel: string;
  kind: string;
  sheetStatus: string;
  teamName: string;
  cohortCode: string;
  cohortName: string;
};

/** Date ascending, then morning before afternoon, then start time. */
function sortShiftRows(rows: AttendanceRow[]) {
  return [...rows].sort((a, b) => {
    const byDate = String(a.shiftDate || '').localeCompare(String(b.shiftDate || ''));
    if (byDate) return byDate;

    const periodOf = (row: AttendanceRow) => {
      const raw = String(row.period || row.periodLabel || '').toLowerCase();
      if (raw.startsWith('afternoon')) return 1;
      if (raw.startsWith('morning')) return 0;
      const hour = Number(String(row.startTime || '00').slice(0, 2));
      return Number.isFinite(hour) && hour >= 13 ? 1 : 0;
    };
    const byPeriod = periodOf(a) - periodOf(b);
    if (byPeriod) return byPeriod;

    return String(a.startTime || '').localeCompare(String(b.startTime || ''))
      || String(a.shiftName || '').localeCompare(String(b.shiftName || ''));
  });
}

type Summary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

function formatCheckIn(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(status: string) {
  if (status === 'present') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
  if (status === 'late') return 'border-amber-500/40 bg-amber-500/15 text-amber-200';
  if (status === 'excused') return 'border-sky-500/40 bg-sky-500/15 text-sky-200';
  return 'border-white/10 bg-black/30 text-zinc-300';
}

export function VolunteerAttendanceHistory({
  volunteerId,
  canEdit = false,
}: {
  volunteerId: string;
  /** Superadmin-only: toggle marks from this panel. */
  canEdit?: boolean;
}) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(!canEdit);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load(nextVerifiedOnly = verifiedOnly) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!nextVerifiedOnly) params.set('verifiedOnly', '0');
      const payload = await adminFetch<{ rows: AttendanceRow[]; summary: Summary; verifiedOnly: boolean }>(
        `/api/admin/registrations/${volunteerId}/attendance?${params}`,
      );
      setRows(sortShiftRows(payload.rows ?? []));
      setSummary(payload.summary);
      setVerifiedOnly(payload.verifiedOnly);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load attendance history.');
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(canEdit ? false : true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volunteerId, canEdit]);

  const orderedRows = useMemo(() => sortShiftRows(rows), [rows]);

  const summaryLine = useMemo(() => {
    if (!summary) return 'No attendance marks yet';
    const attended = summary.present + summary.late;
    const bits = [
      `${attended} attended`,
      summary.late ? `${summary.late} late` : null,
      `${summary.absent} absent`,
      summary.excused ? `${summary.excused} excused` : null,
      `${summary.total} sheet${summary.total === 1 ? '' : 's'}`,
    ].filter(Boolean);
    return bits.join(' · ');
  }, [summary]);

  async function setStatus(row: AttendanceRow, status: AttendanceStatus) {
    if (!canEdit) return;
    if (row.sheetStatus === 'verified') {
      toast.error('This sheet is verified. Reopen it on Attendance before changing marks.');
      return;
    }
    if (row.status === status) return;
    setSavingId(row.shiftId);
    try {
      await adminFetch('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: row.shiftId,
          registrationId: volunteerId,
          status,
          notes: row.notes || '',
        }),
      });
      toast.success(`Marked ${status}`);
      await load(verifiedOnly);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not update attendance.');
    } finally {
      setSavingId(null);
    }
  }

  function toggleAttended(row: AttendanceRow) {
    const next: AttendanceStatus = row.status === 'present' || row.status === 'late' ? 'absent' : 'present';
    void setStatus(row, next);
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 rounded-xl text-left transition hover:bg-white/5"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {expanded ? <ChevronDown className="size-4 text-[#e7c15a]" /> : <ChevronRight className="size-4 text-[#e7c15a]" />}
              <CardTitle>Attendance</CardTitle>
            </div>
            <CardDescription className="mt-1">
              {loading ? 'Loading attendance…' : summaryLine}
              {!expanded ? <span className="ml-1 text-[#e7c15a]">· tap for detail</span> : null}
            </CardDescription>
          </div>
          {!loading && summary ? (
            <div className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', statusTone('present'))}>
                P {summary.present}
              </span>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', statusTone('late'))}>
                L {summary.late}
              </span>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', statusTone('absent'))}>
                A {summary.absent}
              </span>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', statusTone('excused'))}>
                E {summary.excused}
              </span>
            </div>
          ) : null}
        </button>

        {expanded ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={verifiedOnly ? 'default' : 'outline'}
              onClick={() => void load(true)}
            >
              Verified only
            </Button>
            <Button
              size="sm"
              variant={!verifiedOnly ? 'default' : 'outline'}
              onClick={() => void load(false)}
            >
              Include open
            </Button>
            {canEdit ? (
              <p className="self-center text-xs text-zinc-500">
                Superadmin checklist: toggle present / absent, or set late / excused.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      {expanded ? (
        <CardContent className="grid gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? <Skeleton className="h-24 w-full" /> : null}
          {!loading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEdit ? <TableHead className="w-12">In</TableHead> : null}
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Notes</TableHead>
                    {canEdit ? <TableHead>Set status</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedRows.map((row) => {
                    const attended = row.status === 'present' || row.status === 'late';
                    const locked = row.sheetStatus === 'verified';
                    const busy = savingId === row.shiftId;
                    return (
                      <TableRow key={row.id}>
                        {canEdit ? (
                          <TableCell>
                            <input
                              type="checkbox"
                              className="size-4 accent-[#e7c15a]"
                              checked={attended}
                              disabled={locked || busy}
                              aria-label={`Mark ${row.shiftName} attended`}
                              onChange={() => toggleAttended(row)}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          {row.shiftDate}
                          <p className="text-xs text-zinc-500">{row.periodLabel} · {row.startTime}–{row.endTime}</p>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={href(`/admin/attendance?shiftId=${row.shiftId}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ variant: 'link' }), 'h-auto p-0 text-[#f6e7b2]')}
                            title="Open attendance sheet in new page"
                          >
                            {row.shiftName}
                          </Link>
                          <p className="text-xs text-zinc-500">
                            {row.cohortCode || row.cohortName || 'Event'}
                            {row.teamName ? ` · ${row.teamName}` : ''}
                            {' · '}
                            {row.kind}
                            {' · '}
                            {row.sheetStatus}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] capitalize', statusTone(row.status))}>
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell>{formatCheckIn(row.checkedInAt)}</TableCell>
                        <TableCell>{row.notes || '—'}</TableCell>
                        {canEdit ? (
                          <TableCell>
                            <div className="grid min-w-[10rem] grid-cols-2 gap-1">
                              {ATTENDANCE_STATUSES.map((status) => (
                                <Button
                                  key={status}
                                  size="sm"
                                  variant={row.status === status ? 'default' : 'outline'}
                                  className="h-8 capitalize"
                                  disabled={locked || busy}
                                  onClick={() => void setStatus(row, status)}
                                >
                                  {status}
                                </Button>
                              ))}
                            </div>
                            {locked ? (
                              <p className="mt-1 text-[11px] text-amber-300/90">Verified — reopen to edit</p>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                  {orderedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 7 : 5} className="text-zinc-400">
                        No attendance marks{verifiedOnly ? ' on verified sheets' : ''} yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
