'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Download, Plus, Search } from 'lucide-react';
import {
  SECTORS,
  isKnownSubsector,
  sectorHasSubsectors,
  sectorsMatch,
  subsectorFieldForSector,
  subsectorLabelForSector,
  subsectorOptionsForSector,
} from '@cphia/shared/constants';
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
import { ReviewStatusActions } from '@/components/admin/review-status-actions';
import { StatusBadge } from '@/components/admin/status-badge';
import { SubsectorMultiSelect } from '@/components/admin/subsector-multi-select';
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
import { CphiaLoader } from '@/components/brand/cphia-loader';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function rowSubsectors(row: RegistrationSummary) {
  const field = subsectorFieldForSector(row.sector);
  if (field === 'health_subsectors') return row.healthSubsectors ?? [];
  if (field === 'role_subsectors') return row.roleSubsectors ?? [];
  return [];
}

function metricsFromRows(rows: RegistrationSummary[]): RegistrationMetrics {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] += 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 } satisfies RegistrationMetrics,
  );
}

/** Sector filter is exact — Transport means sector Transport only, not a Transport sub-category. */
function rowMatchesSectorFilter(row: RegistrationSummary, sector: string) {
  if (!sector) return true;
  return sectorsMatch(row.sector, sector);
}

function rowMatchesSubsectorFilter(row: RegistrationSummary, sector: string, subsector: string) {
  if (!subsector) return true;
  const field = subsectorFieldForSector(sector || row.sector);
  if (field === 'health_subsectors') return (row.healthSubsectors ?? []).includes(subsector);
  if (field === 'role_subsectors') return (row.roleSubsectors ?? []).includes(subsector);
  // Fallback: check both arrays when sector filter is empty.
  return (
    (row.healthSubsectors ?? []).includes(subsector) ||
    (row.roleSubsectors ?? []).includes(subsector)
  );
}

const emptyMetrics: RegistrationMetrics = { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 };
const PAGE_SIZE = 25;

async function copyField(label: string, value: string) {
  const text = value.trim();
  if (!text) {
    toast.error(`No ${label.toLowerCase()} to copy.`);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  } catch {
    toast.error('Could not copy to clipboard.');
  }
}

function CopyFieldButton({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-white/10 hover:text-foreground',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        void copyField(label, value);
      }}
    >
      <Copy className="size-3.5" />
    </button>
  );
}

function ListReviewNote({ status, note }: { status: AdminStatus; note: string }) {
  if ((status !== 'flagged' && status !== 'review') || !note.trim()) return null;
  return (
    <p className="mt-1 max-w-[16rem] text-xs leading-snug text-amber-200/90" title={note}>
      {note}
    </p>
  );
}

type IndexCache = {
  items: RegistrationSummary[];
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
    isKnownSubsector(initialSubsector) ? initialSubsector : '',
  );
  const [savingSubsectorId, setSavingSubsectorId] = useState<string | null>(null);
  const [exportSector, setExportSector] = useState(initialSector);
  const [exportSubsector, setExportSubsector] = useState(initialSubsector);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(EXPORT_COLUMNS.map((column) => column.id));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [statusExpandId, setStatusExpandId] = useState<string | null>(null);
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
    // Always load the full cohort. Status / sector / search filter client-side so
    // people are not missing when the active chip would have excluded them from the API slice.
    if (cacheRef.current) {
      setIndex(cacheRef.current.items);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ mode: 'index', pageSize: '5000' });
    const response = await fetch(`/api/admin/registrations?${params}`);
    const payload = await response.json();
    const items = (payload.registrations ?? []) as RegistrationSummary[];
    const total = Number(payload.total ?? items.length);
    if (total > 0 && items.length < total) {
      console.error('volunteer_index_incomplete', { loaded: items.length, total });
      toast.error(`Only loaded ${items.length} of ${total} volunteers. Refresh to retry.`);
    }
    cacheRef.current = {
      items,
      total,
    };
    setIndex(items);
    setLoading(false);
  }, []);

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

  const scopedForMetrics = useMemo(
    () =>
      index.filter(
        (row) => rowMatchesSectorFilter(row, sector) && rowMatchesSubsectorFilter(row, sector, subsector),
      ),
    [index, sector, subsector],
  );

  useEffect(() => {
    setMetrics(metricsFromRows(scopedForMetrics));
  }, [scopedForMetrics]);

  const filtered = useMemo(() => {
    const q = search.trim();
    // Search always scans the full cohort so status/sector chips cannot hide people.
    if (q) return index.filter((row) => matchesVolunteerSearch(row, q));
    return scopedForMetrics.filter((row) => status === 'all' || row.status === status);
  }, [index, scopedForMetrics, status, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showSubsectorFilter = sectorHasSubsectors(sector);
  const subsectorFilterOptions = subsectorOptionsForSector(sector);
  const subsectorFilterLabel = subsectorLabelForSector(sector);

  async function saveRowSubsectors(row: RegistrationSummary, next: string[]) {
    const field = subsectorFieldForSector(row.sector);
    if (!field) return;
    setSavingSubsectorId(row.id);
    const response = await fetch(`/api/admin/registrations/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    });
    setSavingSubsectorId(null);
    if (!response.ok) {
      toast.error('Could not update sub-sector.');
      return;
    }
    setIndex((current) =>
      current.map((item) => {
        if (item.id !== row.id) return item;
        if (field === 'health_subsectors') return { ...item, healthSubsectors: next };
        return { ...item, roleSubsectors: next };
      }),
    );
    if (cacheRef.current) {
      cacheRef.current = {
        ...cacheRef.current,
        items: cacheRef.current.items.map((item) => {
          if (item.id !== row.id) return item;
          if (field === 'health_subsectors') return { ...item, healthSubsectors: next };
          return { ...item, roleSubsectors: next };
        }),
      };
    }
    toast.success('Sub-sector updated.');
  }

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  async function setReviewStatus(
    id: string,
    action: AdminStatus | null,
    reason = '',
    areas: string[] = [],
  ) {
    const response = await fetch(`/api/admin/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action ? { action, reason, areas } : { reason, areas }),
    });
    if (!response.ok) {
      toast.error(action ? 'Could not update status.' : 'Could not save reason.');
      return;
    }
    toast.success(action ? `Status set to ${action}.` : 'Reason saved.');
    setStatusExpandId(null);
    if (action) {
      setIndex((current) =>
        current.map((item) => (item.id === id ? { ...item, status: action } : item)),
      );
      if (cacheRef.current) {
        cacheRef.current = {
          ...cacheRef.current,
          items: cacheRef.current.items.map((item) =>
            item.id === id ? { ...item, status: action } : item,
          ),
        };
      }
    }
  }

  async function removeVolunteer() {
    if (!deleteId) return;
    const response = await fetch(`/api/admin/registrations/${deleteId}`, { method: 'DELETE' });
    const removedId = deleteId;
    setDeleteId(null);
    if (!response.ok) {
      toast.error('Could not delete volunteer.');
      return;
    }
    toast.success('Volunteer deleted.');
    setIndex((current) => current.filter((item) => item.id !== removedId));
    if (cacheRef.current) {
      cacheRef.current = {
        ...cacheRef.current,
        items: cacheRef.current.items.filter((item) => item.id !== removedId),
        total: Math.max(0, cacheRef.current.total - 1),
      };
    }
  }

  function exportFile(format: 'csv' | 'xlsx') {
    const required = ['sector', 'health_subsectors', 'role_subsectors'];
    const columns = [...selectedColumns];
    for (const id of required) {
      if (!columns.includes(id)) {
        const sectorAt = columns.indexOf('sector');
        columns.splice(sectorAt >= 0 ? sectorAt + 1 : columns.length, 0, id);
      }
    }
    const params = new URLSearchParams({ columns: columns.join(','), format });
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    if (exportSector) params.set('sector', exportSector);
    if (exportSubsector) params.set('subsector', exportSubsector);
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
                setExportSector(sector);
                setExportSubsector(subsector);
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
            <div className={`grid gap-3 ${showSubsectorFilter ? 'sm:grid-cols-2' : ''}`}>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Sector</span>
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  value={sector}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSector(next);
                    if (!sectorHasSubsectors(next)) setSubsector('');
                    else if (subsector && !subsectorOptionsForSector(next).includes(subsector)) {
                      setSubsector('');
                    }
                  }}
                >
                  <option value="">All sectors</option>
                  {SECTORS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              {showSubsectorFilter ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">{subsectorFilterLabel}</span>
                  <select
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                    value={subsector}
                    onChange={(event) => {
                      setSubsector(event.target.value);
                    }}
                  >
                    <option value="">All</option>
                    {subsectorFilterOptions.map((option) => (
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
                        <div className="flex items-center gap-1">
                          <p className="truncate font-medium text-white">{row.name}</p>
                          <CopyFieldButton label="Name" value={row.name} className="text-zinc-400 hover:text-white" />
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <p className="truncate font-mono text-[11px] text-zinc-400">{row.registrationId}</p>
                          <CopyFieldButton label="ID" value={row.registrationId} className="text-zinc-400 hover:text-white" />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge status={row.status} />
                        <ListReviewNote status={row.status} note={row.reviewNote} />
                      </div>
                    </div>
                    <div className="grid gap-1 text-xs text-zinc-400">
                      <div className="flex min-w-0 items-center gap-1">
                        <p className="truncate">{row.phone || '—'}{row.email ? ` · ${row.email}` : ''}</p>
                        <CopyFieldButton label="Phone" value={row.phone} className="text-zinc-400 hover:text-white" />
                      </div>
                      <p className="truncate">{row.sector}</p>
                      {sectorHasSubsectors(row.sector) && canUpdate ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <SubsectorMultiSelect
                            label={subsectorLabelForSector(row.sector)}
                            options={subsectorOptionsForSector(row.sector)}
                            value={rowSubsectors(row)}
                            disabled={savingSubsectorId === row.id}
                            triggerClassName="max-w-none"
                            onChange={(next) => void saveRowSubsectors(row, next)}
                          />
                        </div>
                      ) : rowSubsectors(row).length > 0 ? (
                        <p className="truncate text-xs">{rowSubsectors(row).join(', ')}</p>
                      ) : null}
                      <p className="truncate">FAN {row.fanNumber || '—'}{row.cohort ? ` · ${row.cohort}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
                      {openFullRecord ? (
                        <Link href={href(volunteerHref(row.id))} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Open</Link>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openVolunteer(row.id)}>View</Button>
                      )}
                      {canUpdate ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={row.status === 'approved'}
                          onClick={() => void setReviewStatus(row.id, 'approved')}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canUpdate ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatusExpandId((current) => (current === row.id ? null : row.id))}
                        >
                          {statusExpandId === row.id ? 'Hide' : 'Status'}
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>Delete</Button>
                      ) : null}
                    </div>
                    {statusExpandId === row.id ? (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3" onClick={(event) => event.stopPropagation()}>
                        <ReviewStatusActions
                          compact
                          currentStatus={row.status}
                          onChange={(action, reason, areas) => setReviewStatus(row.id, action, reason, areas)}
                        />
                      </div>
                    ) : null}
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
                    <Fragment key={row.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => openVolunteer(row.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-1">
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
                            <CopyFieldButton label="Name" value={row.name} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {[row.firstName && `Name: ${row.firstName}`, row.middleName && `Father: ${row.middleName}`, row.lastName && `Grandfather: ${row.lastName}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.cohort}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">{row.registrationId}</span>
                            <CopyFieldButton label="ID" value={row.registrationId} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <p>{row.phone || '—'}</p>
                            <CopyFieldButton label="Phone" value={row.phone} />
                          </div>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.fanNumber || '—'}</TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <p>{row.sector}</p>
                          {sectorHasSubsectors(row.sector) && canUpdate ? (
                            <div className="mt-1.5">
                              <SubsectorMultiSelect
                                label={subsectorLabelForSector(row.sector)}
                                options={subsectorOptionsForSector(row.sector)}
                                value={rowSubsectors(row)}
                                disabled={savingSubsectorId === row.id}
                                onChange={(next) => void saveRowSubsectors(row, next)}
                              />
                            </div>
                          ) : rowSubsectors(row).length > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">{rowSubsectors(row).join(', ')}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                          <ListReviewNote status={row.status} note={row.reviewNote} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                            {openFullRecord ? (
                              <Link href={href(volunteerHref(row.id))} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Open</Link>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => openVolunteer(row.id)}>View</Button>
                            )}
                            {canUpdate ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={row.status === 'approved'}
                                onClick={() => void setReviewStatus(row.id, 'approved')}
                              >
                                Approve
                              </Button>
                            ) : null}
                            {canUpdate ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setStatusExpandId((current) => (current === row.id ? null : row.id))}
                              >
                                {statusExpandId === row.id ? 'Hide' : 'Status'}
                              </Button>
                            ) : null}
                            {canManage ? (
                              <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>Delete</Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      {statusExpandId === row.id ? (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-black/20">
                            <ReviewStatusActions
                              compact
                              currentStatus={row.status}
                              onChange={(action, reason, areas) => setReviewStatus(row.id, action, reason, areas)}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                    ))}
              </TableBody>
            </Table>
          </div>
          {!loading && rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.trim()
                ? 'No volunteers match this search.'
                : 'No volunteers match these filters.'}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {safePage} of {pageCount} · {filtered.length} shown
              {` · ${index.length} loaded`}
              {cacheRef.current && cacheRef.current.total > index.length
                ? ` of ${cacheRef.current.total}`
                : ''}
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
        description="Sector = exact sector only. Sub-category only appears for Health / UNICEF / U-Report / Serve Global / Ethiopian Youth Council. Choose columns, then download."
        onExport={exportFile}
      >
        <div className={`mb-3 grid gap-3 ${sectorHasSubsectors(exportSector) ? 'sm:grid-cols-2' : ''}`}>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Sector</span>
            <select
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={exportSector}
              onChange={(event) => {
                const next = event.target.value;
                setExportSector(next);
                if (!sectorHasSubsectors(next)) setExportSubsector('');
                else if (exportSubsector && !subsectorOptionsForSector(next).includes(exportSubsector)) {
                  setExportSubsector('');
                }
              }}
            >
              <option value="">All sectors</option>
              {SECTORS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          {sectorHasSubsectors(exportSector) ? (
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{subsectorLabelForSector(exportSector)}</span>
              <select
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={exportSubsector}
                onChange={(event) => setExportSubsector(event.target.value)}
              >
                <option value="">All sub-categories</option>
                {subsectorOptionsForSector(exportSector).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {exportSector && !exportSubsector
              ? `Exporting only people whose sector is ${exportSector}.`
              : exportSector && exportSubsector
                ? `Exporting ${exportSector} people assigned to ${exportSubsector}.`
                : [
                    status !== 'all' ? `Status: ${status}` : null,
                    search.trim() ? `Search: ${search.trim()}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No sector filter — exporting the full loaded cohort.'}
          </p>
        </div>
      </ExportColumnsDialog>

      <VolunteerPreviewDialog
        volunteerId={previewId}
        open={Boolean(previewId)}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        onStatusChange={
          canUpdate
            ? async (id, action, reason, areas) => {
                await setReviewStatus(id, action, reason, areas);
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
    <Suspense fallback={<CphiaLoader fullscreen size="lg" label="Loading volunteers" />}>
      <VolunteersTable />
    </Suspense>
  );
}
