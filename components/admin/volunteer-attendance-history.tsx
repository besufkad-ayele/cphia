'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/app/lib/admin/messages';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type AttendanceRow = {
  id: string;
  status: string;
  notes: string;
  checkedInAt: string | null;
  shiftId: string;
  shiftName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  periodLabel: string;
  kind: string;
  sheetStatus: string;
  teamName: string;
  cohortCode: string;
  cohortName: string;
};

type Summary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

export function VolunteerAttendanceHistory({ volunteerId }: { volunteerId: string }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextVerifiedOnly = verifiedOnly) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!nextVerifiedOnly) params.set('verifiedOnly', '0');
      const payload = await adminFetch<{ rows: AttendanceRow[]; summary: Summary; verifiedOnly: boolean }>(
        `/api/admin/registrations/${volunteerId}/attendance?${params}`,
      );
      setRows(payload.rows);
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
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volunteerId]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Attendance history</CardTitle>
          <CardDescription>
            Shifts this volunteer was marked on. Default view is verified sheets only (official record).
          </CardDescription>
        </div>
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
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? <Skeleton className="h-24 w-full" /> : null}
        {!loading && summary ? (
          <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-white/10 px-3 py-1">Total {summary.total}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Present {summary.present}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Late {summary.late}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Absent {summary.absent}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Excused {summary.excused}</span>
          </div>
        ) : null}
        {!loading ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.shiftDate}
                      <p className="text-xs text-zinc-500">{row.periodLabel} · {row.startTime}–{row.endTime}</p>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={href(`/admin/attendance?shiftId=${row.shiftId}`)}
                        className={cn(buttonVariants({ variant: 'link' }), 'h-auto p-0 text-[#f6e7b2]')}
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
                    <TableCell className="capitalize">{row.status}</TableCell>
                    <TableCell>
                      {row.checkedInAt
                        ? new Date(row.checkedInAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell>{row.notes || '—'}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-zinc-400">
                      No attendance marks{verifiedOnly ? ' on verified sheets' : ''} yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
