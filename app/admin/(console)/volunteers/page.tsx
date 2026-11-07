'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Plus, Search } from 'lucide-react';
import { HEALTH_SUBSECTORS, SECTORS } from '@cphia/shared/constants';
import { toast } from 'sonner';
import type { AdminStatus } from '@/app/lib/admin/status';
import { ADMIN_STATUSES } from '@/app/lib/admin/status';
import { matchesVolunteerSearch } from '@/app/lib/admin/registration-filters';
import {
  canVolunteerManage,
  canVolunteerUpdate,
  volunteerAccess,
} from '@/app/lib/admin/permissions';
import type { RegistrationMetrics, RegistrationSummary } from '@/app/lib/admin/types';
import { EXPORT_ASSET_COLUMNS, EXPORT_COLUMNS } from '@/app/lib/admin/types';
import { ExportColumnsDialog } from '@/components/admin/export-columns-dialog';
import { StatusBadge } from '@/components/admin/status-badge';
import { VolunteerPreviewDialog } from '@/components/admin/volunteer-preview-dialog';
import { href } from '@/lib/app-href';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type IndexCache = {
  key: string;
  items: RegistrationSummary[];
  metrics: RegistrationMetrics;
  total: number;
};

function buildListQuery(values: {
  status: 'all' | AdminStatus;
  sector: string;
  subsector: string;
  search: string;
  page: number;
}) {
  const params = new URLSearchParams();
  if (values.status !== 'all') params.set('status', values.status);
  if (values.sector) params.set('sector', values.sector);
  if (values.subsector) params.set('subsector', values.subsector);
  if (values.search.trim()) params.set('q', values.search.trim());
  if (values.page > 1) params.set('page', String(values.page));
  return params.toString();
}

function VolunteersTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status');
  const initialSector = searchParams.get('sector') ?? '';
  const initialSubsector = searchParams.get('subsector') ?? '';
  const initialSearch = searchParams.get('q') ?? '';
  const initialPage = Number(searchParams.get('page') || '1');
  const [index, setIndex] = useState<RegistrationSummary[]>([]);
  const [metrics, setMetrics] = useState<RegistrationMetrics>(emptyMetrics);
  const [status, setStatus] = useState<'all' | AdminStatus>(
    ADMIN_STATUSES.includes(initialStatus as AdminStatus) ? (initialStatus as AdminStatus) : 'all',
  );
  const [sector, setSector] = useState(
    (SECTORS as readonly string[]).includes(initialSector) ? initialSector : '',
  );
  const [subsector, setSubsector] = useState(
    (HEALTH_SUBSECTORS as readonly string[]).includes(initialSubsector) ? initialSubsector : '',
  );
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(EXPORT_COLUMNS.map((column) => column.id));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [session, setSession] = useState<{ role: string; permissions: string[] }>({
    role: 'admin',
    permissions: [],
  });
  const cacheRef = useRef<IndexCache | null>(null);
  const isSuperAdmin = session.role === 'super_admin';
  const access = volunteerAccess(session);
  const canUpdate = canVolunteerUpdate(session);
  const canManage = canVolunteerManage(session);
  const openFullRecord = access === 'update' || access === 'full';

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

  const filterKey = useMemo(
    () => JSON.stringify({ status, sector, subsector }),
    [status, sector, subsector],
  );

  const listQuery = useMemo(
    () => buildListQuery({ status, sector, subsector, search, page }),
    [status, sector, subsector, search, page],
  );

  const listHref = listQuery ? `/admin/volunteers?${listQuery}` : '/admin/volunteers';

  function volunteerHref(id: string) {
    return `/admin/volunteers/${id}?return=${encodeURIComponent(listHref)}`;
  }

  useEffect(() => {
    const next = listQuery ? `?${listQuery}` : '';
    const current = window.location.search;
    if (current === next) return;
    router.replace(href(listHref), { scroll: false });
  }, [listHref, listQuery, router]);

  const loadIndex = useCallback(async () => {
    if (cacheRef.current?.key === filterKey) {
      setIndex(cacheRef.current.items);
      setMetrics(cacheRef.current.metrics);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ mode: 'index', pageSize: '3000' });
    if (status !== 'all') params.set('status', status);
    if (sector) params.set('sector', sector);
    if (subsector) params.set('subsector', subsector);
    const response = await fetch(`/api/admin/registrations?${params}`);
    const payload = await response.json();
    const items = (payload.registrations ?? []) as RegistrationSummary[];
    const nextMetrics = payload.metrics ?? emptyMetrics;
    cacheRef.current = {
      key: filterKey,
      items,
      metrics: nextMetrics,
      total: payload.total ?? items.length,
    };
    setIndex(items);
    setMetrics(nextMetrics);
    setLoading(false);
  }, [filterKey, status, sector, subsector]);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  const filtersReady = useRef(false);
  useEffect(() => {
    if (!filtersReady.current) {
      filtersReady.current = true;
      return;
    }
    setPage(1);
  }, [search, status, sector, subsector]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return index;
    return index.filter((row) => matchesVolunteerSearch(row, q));
  }, [index, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showHealthSubs = sector === 'Health';

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

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
    cacheRef.current = null;
    void loadIndex();
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
    cacheRef.current = null;
    void loadIndex();
  }

  function exportFile(format: 'csv' | 'xlsx') {
    const params = new URLSearchParams({ columns: selectedColumns.join(','), format });
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    if (sector) params.set('sector', sector);
    if (subsector) params.set('subsector', subsector);
    window.location.assign(`/api/admin/registrations/export?${params}`);
    setExportOpen(false);
  }

  function openVolunteer(id: string) {
    if (openFullRecord) {
      router.push(href(volunteerHref(id)));
      return;
    }
    setPreviewId(id);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
          <p className="text-sm text-muted-foreground">
            Sorted by name · father · grandfather. Search runs instantly on the loaded list.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {canManage ? (
            <Link href={href('/admin/volunteers/new')} className={cn(buttonVariants(), 'h-11')}>
              <Plus className="size-4" />
              Register volunteer
            </Link>
          ) : null}
          {canManage ? (
            <Button
              className="h-11"
              variant="outline"
              onClick={() => {
                setSelectedColumns([
                  ...EXPORT_COLUMNS.map((column) => column.id),
                  ...(isSuperAdmin ? EXPORT_ASSET_COLUMNS.map((column) => column.id) : []),
                ]);
                setExportOpen(true);
              }}
            >
              <Download className="size-4" />
              Export
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-base">Registrations</CardTitle>
          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, father name, grandfather name, FAN, phone, email, or ID"
                className="h-11 pl-9"
              />
            </div>
            <div className={`grid gap-3 ${showHealthSubs ? 'sm:grid-cols-2' : ''}`}>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Sector</span>
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  value={sector}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSector(next);
                    if (next !== 'Health') setSubsector('');
                    cacheRef.current = null;
                  }}
                >
                  <option value="">All sectors</option>
                  {SECTORS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              {showHealthSubs ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">Health sub-sector</span>
                  <select
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                    value={subsector}
                    onChange={(event) => {
                      setSubsector(event.target.value);
                      cacheRef.current = null;
                    }}
                  >
                    <option value="">All sub-sectors</option>
                    {HEALTH_SUBSECTORS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
              {filters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={status === filter.id ? 'default' : 'outline'}
                  className="h-11 shrink-0"
                  onClick={() => {
                    setStatus(filter.id);
                    cacheRef.current = null;
                  }}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile / tablet: 1–2 column cards. Desktop: full table. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-2 h-4 w-full" />
                    <Skeleton className="mt-2 h-4 w-1/2" />
                  </div>
                ))
              : rows.map((row) => (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openVolunteer(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openVolunteer(row.id);
                      }
                    }}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{row.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{row.registrationId}</p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="grid gap-1 text-xs text-zinc-400">
                      <p className="truncate">{row.phone || '—'}{row.email ? ` · ${row.email}` : ''}</p>
                      <p className="truncate">
                        {row.sector}
                        {(row.healthSubsectors?.length ?? 0) > 0 ? ` · ${row.healthSubsectors?.join(', ')}` : ''}
                      </p>
                      <p className="truncate">FAN {row.fanNumber || '—'}{row.cohort ? ` · ${row.cohort}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
                      {openFullRecord ? (
                        <Link href={href(volunteerHref(row.id))} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Open</Link>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openVolunteer(row.id)}>View</Button>
                      )}
                      {canUpdate && row.status !== 'approved' ? (
                        <Button size="sm" variant="secondary" onClick={() => void setReviewStatus(row.id, 'approved')}>Approve</Button>
                      ) : null}
                      {canManage ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>Delete</Button>
                      ) : null}
                    </div>
                  </div>
                ))}
          </div>

          <div className="hidden lg:block">
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
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => openVolunteer(row.id)}
                      >
                        <TableCell>
                          {openFullRecord ? (
                            <Link
                              href={href(volunteerHref(row.id))}
                              className="font-medium hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {row.name}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="text-left font-medium hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                openVolunteer(row.id);
                              }}
                            >
                              {row.name}
                            </button>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {[row.firstName && `Name: ${row.firstName}`, row.middleName && `Father: ${row.middleName}`, row.lastName && `Grandfather: ${row.lastName}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.cohort}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.registrationId}</TableCell>
                        <TableCell>
                          <p>{row.phone}</p>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.fanNumber || '—'}</TableCell>
                        <TableCell>
                          <p>{row.sector}</p>
                          {(row.healthSubsectors?.length ?? 0) > 0 ? (
                            <p className="text-xs text-muted-foreground">{row.healthSubsectors?.join(', ')}</p>
                          ) : null}
                        </TableCell>
                        <TableCell><StatusBadge status={row.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                            {openFullRecord ? (
                              <Link href={href(volunteerHref(row.id))} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Open</Link>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => openVolunteer(row.id)}>View</Button>
                            )}
                            {canUpdate && row.status !== 'approved' ? (
                              <Button size="sm" variant="secondary" onClick={() => void setReviewStatus(row.id, 'approved')}>Approve</Button>
                            ) : null}
                            {canManage ? (
                              <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>Delete</Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          {!loading && rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No volunteers match this search.</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {safePage} of {pageCount} · {filtered.length} shown
              {search.trim() ? ` (filtered from ${index.length})` : ''}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" disabled={safePage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button variant="outline" className="h-11" disabled={safePage >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExportColumnsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedColumns={selectedColumns}
        onSelectedColumnsChange={setSelectedColumns}
        includeAssets={isSuperAdmin}
        title="Export volunteers"
        description="Choose columns, then download Excel or CSV. Current search, status, sector, and sub-sector filters apply."
        onExport={exportFile}
      />

      <VolunteerPreviewDialog
        volunteerId={previewId}
        open={Boolean(previewId)}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        onStatusChange={
          canUpdate
            ? async (id, action) => {
                await setReviewStatus(id, action);
                setPreviewId(null);
              }
            : undefined
        }
      />

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
