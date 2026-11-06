'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminStatus } from '@/app/lib/admin/status';
import { ADMIN_STATUSES } from '@/app/lib/admin/status';
import type { RegistrationMetrics, RegistrationSummary } from '@/app/lib/admin/types';
import { EXPORT_COLUMNS } from '@/app/lib/admin/types';
import { StatusBadge } from '@/components/admin/status-badge';
import { href } from '@/lib/app-href';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const emptyMetrics: RegistrationMetrics = { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 };
const PAGE_SIZE = 25;

function VolunteersTable() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status');
  const [rows, setRows] = useState<RegistrationSummary[]>([]);
  const [metrics, setMetrics] = useState<RegistrationMetrics>(emptyMetrics);
  const [status, setStatus] = useState<'all' | AdminStatus>(
    ADMIN_STATUSES.includes(initialStatus as AdminStatus) ? (initialStatus as AdminStatus) : 'all',
  );
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(EXPORT_COLUMNS.map((column) => column.id));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status !== 'all') params.set('status', status);
    if (debouncedSearch) params.set('search', debouncedSearch);
    const response = await fetch(`/api/admin/registrations?${params}`);
    const payload = await response.json();
    setRows(payload.registrations ?? []);
    setMetrics(payload.metrics ?? emptyMetrics);
    setTotal(payload.total ?? 0);
    setLoading(false);
  }, [page, status, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function setReviewStatus(id: string, action: AdminStatus) {
    const response = await fetch(`/api/admin/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      toast.error('Could not update status.');
      return;
    }
    toast.success('Status updated.');
    void load();
  }

  async function removeVolunteer() {
    if (!deleteId) return;
    const response = await fetch(`/api/admin/registrations/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    if (!response.ok) {
      toast.error('Could not delete volunteer.');
      return;
    }
    toast.success('Volunteer deleted.');
    void load();
  }

  function exportFile(format: 'csv' | 'xlsx') {
    const params = new URLSearchParams({ columns: selectedColumns.join(','), format });
    if (status !== 'all') params.set('status', status);
    if (debouncedSearch) params.set('search', debouncedSearch);
    window.location.assign(`/api/admin/registrations/export?${params}`);
    setExportOpen(false);
  }

  const filters = useMemo(
    () => [
      { id: 'all' as const, label: `All (${metrics.total})` },
      { id: 'pending' as const, label: `Pending (${metrics.pending})` },
      { id: 'approved' as const, label: `Approved (${metrics.approved})` },
      { id: 'review' as const, label: `Review (${metrics.review})` },
      { id: 'flagged' as const, label: `Flagged (${metrics.flagged})` },
    ],
    [metrics],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
          <p className="text-sm text-muted-foreground">Search, review, update, export, and manage the CPHIA-26 cohort.</p>
        </div>
        <Button className="h-11" onClick={() => setExportOpen(true)}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-base">Registrations</CardTitle>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, FAN, phone, email, or ID"
                className="h-11 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={status === filter.id ? 'default' : 'outline'}
                  className="h-11"
                  onClick={() => {
                    setStatus(filter.id);
                    setPage(1);
                  }}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volunteer</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>FAN</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }).map((__, cell) => (
                        <TableCell key={cell}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link href={href(`/admin/volunteers/${row.id}`)} className="font-medium hover:underline">{row.name}</Link>
                        <p className="text-xs text-muted-foreground">{row.cohort}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.registrationId}</TableCell>
                      <TableCell>
                        <p>{row.phone}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.fanNumber || '—'}</TableCell>
                      <TableCell>{row.sector}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={href(`/admin/volunteers/${row.id}`)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Open</Link>
                          {row.status !== 'approved' ? (
                            <Button size="sm" variant="secondary" onClick={() => void setReviewStatus(row.id, 'approved')}>Approve</Button>
                          ) : null}
                          <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!loading && rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No volunteers match this search.</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Page {page} of {pageCount} · {total} volunteers</p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button variant="outline" className="h-11" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export volunteers</DialogTitle>
            <DialogDescription>Choose columns, then download Excel or CSV. Current search and status filters apply.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {EXPORT_COLUMNS.map((column) => (
              <label key={column.id} className="flex min-h-10 items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedColumns.includes(column.id)}
                  onCheckedChange={(checked) => {
                    setSelectedColumns((current) =>
                      checked ? [...current, column.id] : current.filter((id) => id !== column.id),
                    );
                  }}
                />
                {column.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedColumns(EXPORT_COLUMNS.map((column) => column.id))}>Select all</Button>
            <Button variant="outline" className="h-11" disabled={!selectedColumns.length} onClick={() => exportFile('csv')}>CSV</Button>
            <Button className="h-11" disabled={!selectedColumns.length} onClick={() => exportFile('xlsx')}>Excel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete volunteer?</DialogTitle>
            <DialogDescription>This removes the registration from the CPHIA-26 cohort. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void removeVolunteer()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VolunteersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <VolunteersTable />
    </Suspense>
  );
}
