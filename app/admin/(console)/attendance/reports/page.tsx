'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ATTENDANCE_EXPORT_COLUMNS,
  DEFAULT_ATTENDANCE_EXPORT_COLUMNS,
} from '@/app/lib/admin/attendance-columns';
import { ATTENDANCE_STATUSES } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { ExportColumnsDialog } from '@/components/admin/export-columns-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

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
  totals: { total: number; present: number; late: number; absent: number; excused: number; attended: number };
  averages: {
    avgParticipationPercent: number;
    avgAttendedPerDay: number;
    avgRosterPerDay: number;
    dayCount: number;
  };
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

type BlockDetail = {
  canExport: boolean;
  verifiedOnly: boolean;
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
  totals: BlockCard['totals'];
  averages: BlockCard['averages'];
  byDay: Array<{
    date: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    total: number;
    attended: number;
    shifts: number;
    participationPercent: number;
  }>;
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
  byPerson: Array<{
    registrationId: string;
    publicId: string;
    name: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    total: number;
    attended: number;
    participationPercent: number;
  }>;
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
  totals: BlockCard['totals'];
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

export default function AttendanceReportsPage() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canExport, setCanExport] = useState(false);
  const [blocks, setBlocks] = useState<BlockCard[]>([]);
  const [ungrouped, setUngrouped] = useState<UngroupedShift[]>([]);
  const [blockDetail, setBlockDetail] = useState<BlockDetail | null>(null);
  const [shiftDetail, setShiftDetail] = useState<ShiftDetail | null>(null);
  const [includePending, setIncludePending] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [exportSearch, setExportSearch] = useState('');
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }

  async function loadBlock(blockId: string, pending = includePending) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!pending) params.set('verifiedOnly', '1');
      const payload = await adminFetch<BlockDetail>(`/api/admin/attendance/reports/blocks/${blockId}?${params}`);
      setCanExport(payload.canExport);
      setBlockDetail(payload);
      setShiftDetail(null);
      setView({ kind: 'block', blockId });
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

  const exportScope = useMemo(() => {
    if (view.kind === 'block') return { blockId: view.blockId };
    if (view.kind === 'shift') return { shiftId: view.shiftId };
    return {};
  }, [view]);

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
    const params = new URLSearchParams();
    params.set('format', format);
    params.set('columns', selectedColumns.join(','));
    if (exportStatus) params.set('status', exportStatus);
    if (exportSearch.trim()) params.set('q', exportSearch.trim());
    if (exportScope.blockId) params.set('blockId', exportScope.blockId);
    if (exportScope.shiftId) params.set('shiftId', exportScope.shiftId);
    // Include pending sheets (open/submitted) unless user is on verified-only block view.
    if (!includePending && view.kind === 'block') params.set('verifiedOnly', '1');
    window.location.href = `/api/admin/attendance/export?${params.toString()}`;
    setExportOpen(false);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          kicker="REPORTS"
          title="Attendance reports"
          description="Start from a bulk shift block. Open the block for day averages and every volunteer across those days, then click a shift for its detailed sheet. Export filters (status / person) live here — not on the dashboard."
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
                if (view.kind === 'shift' && view.fromBlockId) void loadBlock(view.fromBlockId);
                else void loadList().then(() => setView({ kind: 'list' }));
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
                onClick={() => void loadBlock(block.id)}
                className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-[#e7c15a]/40 hover:bg-[#e7c15a]/5"
              >
                <p className="text-[11px] uppercase tracking-wide text-[#e7c15a]">Bulk block</p>
                <p className="mt-1 text-lg font-semibold text-white">{block.name}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {block.cohortCode || block.cohortName || 'Event'}
                  {block.teamName ? ` · ${block.teamName}` : ''}
                  {' · '}
                  {block.kind}
                </p>
                <p className="text-xs text-zinc-500">
                  {block.startDate} → {block.endDate} · {block.shiftCount} shifts
                  {block.pendingShifts ? ` · ${block.pendingShifts} pending` : ''}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Avg / day</p>
                    <p className="mt-1 font-semibold text-white">
                      {block.averages.avgAttendedPerDay}
                      <span className="text-xs font-normal text-zinc-400"> / {block.averages.avgRosterPerDay}</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Participation</p>
                    <p className="mt-1 font-semibold text-[#f6e7b2]">{block.averages.avgParticipationPercent}%</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Came {block.totals.attended} · Absent {block.totals.absent} · Late {block.totals.late}
                </p>
              </button>
            ))}
            {!loading && blocks.length === 0 ? (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="pt-4 text-sm text-zinc-400">
                  No bulk blocks yet. Create a morning / afternoon date range under Shifts — it becomes a reportable block here.
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
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{blockDetail.block.name}</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  {blockDetail.block.startDate} → {blockDetail.block.endDate}
                  {' · '}
                  {blockDetail.block.cohortCode || blockDetail.block.cohortName}
                  {blockDetail.block.teamName ? ` · ${blockDetail.block.teamName}` : ''}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={includePending}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setIncludePending(next);
                    void loadBlock(blockDetail.block.id, next);
                  }}
                />
                Include pending sheets
              </label>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Avg attended / day" value={`${blockDetail.averages.avgAttendedPerDay}`} note={`of ${blockDetail.averages.avgRosterPerDay} on sheet`} />
              <Stat label="Avg participation" value={`${blockDetail.averages.avgParticipationPercent}%`} note={`${blockDetail.averages.dayCount} days`} />
              <Stat label="Came (present+late)" value={String(blockDetail.totals.attended)} note={`absent ${blockDetail.totals.absent}`} />
              <Stat label="Marks total" value={String(blockDetail.totals.total)} note={`late ${blockDetail.totals.late} · excused ${blockDetail.totals.excused}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Per day</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shifts</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead>On sheet</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Absent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockDetail.byDay.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell>{day.date}</TableCell>
                      <TableCell>{day.shifts}</TableCell>
                      <TableCell>{day.attended}</TableCell>
                      <TableCell>{day.total}</TableCell>
                      <TableCell className="text-[#f6e7b2]">{day.participationPercent}%</TableCell>
                      <TableCell>{day.absent}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Shifts in this block</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {blockDetail.byShift.map((shift) => (
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
                    <p className="text-xs text-zinc-500">{shift.attended}/{shift.total} · absent {shift.absent}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>By person (across the block)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockDetail.byPerson.map((person) => (
                    <TableRow key={person.registrationId}>
                      <TableCell>
                        <Link href={href(`/admin/volunteers/${person.registrationId}`)} className="text-[#f6e7b2] hover:underline">
                          {person.name || 'Volunteer'}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{person.publicId}</TableCell>
                      <TableCell>{person.attended}</TableCell>
                      <TableCell>{person.absent}</TableCell>
                      <TableCell>{person.late}</TableCell>
                      <TableCell>{person.participationPercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                {shiftDetail.shift.teamName ? ` · ${shiftDetail.shift.teamName}` : ''}
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Present" value={String(shiftDetail.totals.present)} />
              <Stat label="Late" value={String(shiftDetail.totals.late)} />
              <Stat label="Absent / pending" value={String(shiftDetail.totals.absent)} />
              <Stat label="Excused" value={String(shiftDetail.totals.excused)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>Volunteers on this shift</CardTitle>
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
                      <TableCell colSpan={5} className="text-zinc-400">No marks on this shift yet. Seed the sheet from Attendance.</TableCell>
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
        description="Pick columns, then optionally filter by status or person. Includes every volunteer on the selected block/shift (present, late, absent/pending, excused)."
        onExport={runExport}
      >
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Field label="Status filter">
            <select className={controlClass} value={exportStatus} onChange={(event) => setExportStatus(event.target.value)}>
              <option value="">All statuses (incl. pending/absent)</option>
              {ATTENDANCE_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </Field>
          <Field label="Person search">
            <input
              className={controlClass}
              value={exportSearch}
              placeholder="Name · ID · phone"
              onChange={(event) => setExportSearch(event.target.value)}
            />
          </Field>
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
