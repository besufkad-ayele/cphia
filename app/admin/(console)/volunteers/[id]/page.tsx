'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Download, Upload } from 'lucide-react';
import {
  ALL_BANKS,
  EDUCATION_LEVELS,
  ETHIOPIA_REGIONS,
  HEALTH_SUBSECTORS,
  NATIONALITIES,
  SECTORS,
  SECOND_ID_TYPES,
} from '@cphia/shared/constants';
import { toast } from 'sonner';
import {
  canVolunteerManage,
  canVolunteerUpdate,
  volunteerAccess,
} from '@/app/lib/admin/permissions';
import type { AdminStatus } from '@/app/lib/admin/status';
import { ADMIN_STATUSES } from '@/app/lib/admin/status';
import { EXPORT_ASSET_COLUMNS, EXPORT_COLUMNS } from '@/app/lib/admin/types';
import {
  DOCUMENT_ACCEPT,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  isPdfUrl,
} from '@/app/lib/uploads';
import { prepareUploadFile } from '@/app/lib/prepare-upload';
import { ExportColumnsDialog } from '@/components/admin/export-columns-dialog';
import { ReviewStatusActions } from '@/components/admin/review-status-actions';
import { StatusBadge } from '@/components/admin/status-badge';
import { VolunteerPreviewDialog } from '@/components/admin/volunteer-preview-dialog';
import { href } from '@/lib/app-href';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AdminStatus as MissingVolunteer } from '@/components/status/admin-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CohortDetail = {
  id: string | null;
  name: string;
  code: string;
  venue: string | null;
  startsOn: string | null;
  endsOn: string | null;
  description: string | null;
  status: string | null;
  capacity: number | null;
};

type Detail = Record<string, unknown> & {
  id: string;
  registration_id: string;
  status: AdminStatus;
  photoUrl?: string | null;
  ureportUrl?: string | null;
  fanPhotoUrl?: string | null;
  fanPhotoBackUrl?: string | null;
  secondIdPhotoUrl?: string | null;
  bankOwnerIdPhotoUrl?: string | null;
  cohortDetail?: CohortDetail | null;
  registration_languages?: Array<{ language: string; proficiency: string; language_group?: string }>;
};

type FieldKind = 'text' | 'number' | 'select' | 'boolean' | 'textarea' | 'readonly';

type FieldRow = {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: readonly string[];
};

const FIELD_ROWS: FieldRow[] = [
  { key: 'registration_id', label: 'Registration ID' },
  { key: 'cohort', label: 'Cohort code' },
  { key: 'first_name', label: 'Given name' },
  { key: 'middle_name', label: 'Father name' },
  { key: 'last_name', label: 'Grandfather name' },
  { key: 'amharic_first', label: 'Given name (Amharic)' },
  { key: 'amharic_middle', label: 'Father name (Amharic)' },
  { key: 'amharic_last', label: 'Grandfather name (Amharic)' },
  { key: 'sex', label: 'Sex', kind: 'select', options: ['Male', 'Female'] },
  { key: 'age', label: 'Age', kind: 'number' },
  { key: 'nationality', label: 'Nationality', kind: 'select', options: NATIONALITIES },
  { key: 'fan_number', label: 'FAN number' },
  { key: 'second_id_type', label: 'Second ID type', kind: 'select', options: ['', ...SECOND_ID_TYPES] },
  { key: 'second_id_number', label: 'Second ID number' },
  { key: 'phone', label: 'Phone' },
  { key: 'secondary_phone', label: 'Secondary phone' },
  { key: 'whatsapp_number', label: 'WhatsApp' },
  { key: 'phone_is_whatsapp', label: 'Phone is WhatsApp', kind: 'boolean' },
  { key: 'no_whatsapp', label: 'No WhatsApp', kind: 'boolean' },
  { key: 'email', label: 'Email' },
  { key: 'residence_region', label: 'Region', kind: 'select', options: ETHIOPIA_REGIONS },
  { key: 'residence_detail', label: 'Residence detail' },
  { key: 'profession', label: 'Profession' },
  { key: 'education_level', label: 'Education', kind: 'select', options: EDUCATION_LEVELS },
  { key: 'emergency_name', label: 'Emergency name' },
  { key: 'emergency_phone', label: 'Emergency phone' },
  { key: 'emergency_relationship', label: 'Emergency relationship' },
  { key: 'sector', label: 'Sector', kind: 'select', options: SECTORS },
  { key: 'health_subsectors', label: 'Health sub-sector', kind: 'select', options: ['', ...HEALTH_SUBSECTORS] },
  { key: 'bank_name', label: 'Bank', kind: 'select', options: ALL_BANKS },
  { key: 'bank_account_name', label: 'Account owner name' },
  { key: 'bank_account_number', label: 'Account number' },
  { key: 'bank_account_other_owner', label: 'Account owned by someone else', kind: 'boolean' },
  { key: 'ureport_registered', label: 'U-Report registered', kind: 'boolean' },
  { key: 'review_status', label: 'Review status', kind: 'select', options: ADMIN_STATUSES },
  { key: 'review_note', label: 'Review note', kind: 'textarea' },
  { key: 'ui_language', label: 'UI language', kind: 'select', options: ['en', 'am', 'om', 'ti'] },
  { key: 'created_at', label: 'Submitted', kind: 'readonly' },
];

const IMAGE_SLOTS = [
  { key: 'photo', label: 'Volunteer photo', urlKey: 'photoUrl' as const, accept: DOCUMENT_ACCEPT, requiredHint: 'JPG, PNG, WEBP, HEIC, or PDF' },
  { key: 'fanPhoto', label: 'National ID (front)', urlKey: 'fanPhotoUrl' as const, accept: DOCUMENT_ACCEPT, requiredHint: 'JPG, PNG, WEBP, HEIC, or PDF' },
  { key: 'fanPhotoBack', label: 'National ID (back)', urlKey: 'fanPhotoBackUrl' as const, accept: DOCUMENT_ACCEPT, requiredHint: 'JPG, PNG, WEBP, HEIC, or PDF' },
  { key: 'secondIdPhoto', label: 'Second ID', urlKey: 'secondIdPhotoUrl' as const, accept: DOCUMENT_ACCEPT, requiredHint: 'JPG, PNG, WEBP, HEIC, or PDF' },
  { key: 'bankOwnerIdPhoto', label: 'Account owner ID', urlKey: 'bankOwnerIdPhotoUrl' as const, accept: DOCUMENT_ACCEPT, requiredHint: 'JPG, PNG, WEBP, HEIC, or PDF' },
  { key: 'ureportScreenshot', label: 'U-Report screenshot', urlKey: 'ureportUrl' as const, accept: DOCUMENT_ACCEPT, requiredHint: 'JPG, PNG, WEBP, HEIC, or PDF' },
] as const;

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value == null || value === '') return '—';
  return String(value);
}

function splitAmharicName(value: unknown) {
  const parts = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    amharic_first: parts[0] ?? '',
    amharic_middle: parts.length > 2 ? parts.slice(1, -1).join(' ') : parts[1] ?? '',
    amharic_last: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

function draftFromDetail(payload: Detail) {
  const next: Record<string, string> = {};
  for (const row of FIELD_ROWS) {
    if (row.kind === 'readonly') continue;
    if (row.key === 'amharic_first' || row.key === 'amharic_middle' || row.key === 'amharic_last') continue;
    const value = payload[row.key];
    if (Array.isArray(value)) next[row.key] = value[0] ? String(value[0]) : '';
    else if (typeof value === 'boolean') next[row.key] = value ? 'true' : 'false';
    else next[row.key] = value == null ? '' : String(value);
  }
  Object.assign(next, splitAmharicName(payload.full_name_amharic));
  next.languages = (payload.registration_languages ?? [])
    .map((item) => `${item.language} (${item.proficiency})`)
    .join(', ');
  return next;
}

function ImageEditor({
  label,
  url,
  accept,
  hint,
  busy,
  onUpload,
  onRemove,
  onDownload,
}: {
  label: string;
  url?: string | null;
  accept: string;
  hint: string;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  onDownload?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [localIsPdf, setLocalIsPdf] = useState(false);
  const preview = localPreview || url;
  const isPdf = localPreview ? localIsPdf : isPdfUrl(url);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => {
    if (!busy && url) {
      setLocalPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setLocalIsPdf(false);
    }
  }, [busy, url]);

  return (
    <div className="grid gap-2 border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {busy ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
      </div>
      {preview && !isPdf ? (
        <img src={preview} alt={label} className="w-full rounded-lg object-cover" />
      ) : preview ? (
        <a
          href={preview}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground hover:bg-muted/40"
        >
          PDF on file — open
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">No file</p>
      )}
      <p className="text-xs text-muted-foreground">{hint} · max {MAX_UPLOAD_LABEL}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {url ? 'Replace' : 'Upload'}
        </Button>
        {url && onDownload ? (
          <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={onDownload}>
            <Download className="size-4" />
            Download
          </Button>
        ) : null}
        {url ? (
          <Button type="button" variant="ghost" className="h-10" disabled={busy} onClick={() => void onRemove()}>
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={accept}
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (!next) return;
          if (next.size > MAX_UPLOAD_BYTES) {
            toast.error(`${label} is too large. Maximum allowed is ${MAX_UPLOAD_LABEL}.`);
            return;
          }
          void (async () => {
            const imagesOnly = !accept.includes('application/pdf');
            const prepared = await prepareUploadFile(next, { imagesOnly, compress: true });
            if ('error' in prepared) {
              toast.error(prepared.message);
              return;
            }
            setLocalPreview((current) => {
              if (current) URL.revokeObjectURL(current);
              return URL.createObjectURL(prepared.file);
            });
            setLocalIsPdf(prepared.mime === 'application/pdf');
            try {
              await onUpload(prepared.file);
            } catch {
              setLocalPreview((current) => {
                if (current) URL.revokeObjectURL(current);
                return null;
              });
              setLocalIsPdf(false);
            }
          })();
        }}
      />
    </div>
  );
}

function safeVolunteersReturn(raw: string | null) {
  if (!raw) return '/admin/volunteers';
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('/admin/volunteers') && !decoded.startsWith('//')) return decoded;
  } catch {
    /* ignore */
  }
  return '/admin/volunteers';
}

function VolunteerDetailPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const volunteersHref = useMemo(
    () => href(safeVolunteersReturn(searchParams.get('return'))),
    [searchParams],
  );
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [imageBusy, setImageBusy] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    ...EXPORT_COLUMNS.map((column) => column.id),
    ...EXPORT_ASSET_COLUMNS.map((column) => column.id),
  ]);
  const [session, setSession] = useState<{ role: string; permissions: string[] } | null>(null);
  const [staffPreviewOpen, setStaffPreviewOpen] = useState(false);
  const isSuperAdmin = session?.role === 'super_admin';
  const access = session ? volunteerAccess(session) : null;
  const canUpdate = session ? canVolunteerUpdate(session) : false;
  const canManage = session ? canVolunteerManage(session) : false;
  const readOnlyPopup = access === 'read';

  useEffect(() => {
    fetch('/api/admin/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload) {
          setSession({ role: 'admin', permissions: [] });
          setStaffPreviewOpen(true);
          return;
        }
        const next = {
          role: payload.role || 'admin',
          permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
        };
        setSession(next);
        if (volunteerAccess(next) === 'read') setStaffPreviewOpen(true);
      })
      .catch(() => {
        setSession({ role: 'admin', permissions: [] });
        setStaffPreviewOpen(true);
      });
  }, []);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/admin/registrations/${params.id}`);
    if (!response.ok) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as Detail;
    setDetail(payload);
    setDraft(draftFromDetail(payload));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function patchImage(slotKey: string, payload: FormData) {
    setImageBusy((current) => ({ ...current, [slotKey]: true }));
    try {
      const response = await fetch(`/api/admin/registrations/${params.id}`, {
        method: 'PATCH',
        body: payload,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.error === 'PHOTO_TOO_LARGE') throw new Error(`File is too large. Maximum allowed is ${MAX_UPLOAD_LABEL}.`);
        if (body?.error === 'INVALID_PHOTO') throw new Error('File must be a supported image or PDF.');
        throw new Error(body?.details || 'Could not update the file.');
      }
      await load();
      toast.success('File updated.');
    } finally {
      setImageBusy((current) => ({ ...current, [slotKey]: false }));
    }
  }

  async function uploadImage(slotKey: string, file: File) {
    const form = new FormData();
    form.append(slotKey, file, file.name);
    await patchImage(slotKey, form);
  }

  async function removeImage(slotKey: string) {
    const form = new FormData();
    form.append(`clear_${slotKey}`, 'true');
    await patchImage(slotKey, form);
  }

  async function save() {
    if (!detail) return;
    setSaving(true);
    const form = new FormData();
    const fullNameAmharic = [draft.amharic_first, draft.amharic_middle, draft.amharic_last]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' ');
    for (const [key, value] of Object.entries(draft)) {
      if (key === 'created_at' || key === 'amharic_first' || key === 'amharic_middle' || key === 'amharic_last') continue;
      if (key === 'health_subsectors' && draft.sector !== 'Health') {
        form.append('health_subsectors', '');
        continue;
      }
      form.append(key, value);
    }
    form.append('full_name_amharic', fullNameAmharic);

    const response = await fetch(`/api/admin/registrations/${params.id}`, {
      method: 'PATCH',
      body: form,
    });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload?.details || 'Could not save changes.');
      return;
    }
    toast.success('Volunteer updated.');
    setEditing(false);
    void load();
  }

  async function setStatus(action: AdminStatus | null, reason: string) {
    const response = await fetch(`/api/admin/registrations/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action ? { action, reason } : { reason }),
    });
    if (!response.ok) {
      toast.error(action ? 'Could not update status.' : 'Could not save reason.');
      return;
    }
    toast.success(action ? `Status set to ${action}.` : 'Reason saved.');
    void load();
  }

  async function removeVolunteer() {
    const response = await fetch(`/api/admin/registrations/${params.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Could not delete volunteer.');
      return;
    }
    toast.success('Volunteer deleted.');
    router.replace(volunteersHref);
  }

  function exportVolunteer(format: 'csv' | 'xlsx') {
    const columns = selectedColumns.join(',');
    window.location.assign(`/api/admin/registrations/export?id=${params.id}&columns=${encodeURIComponent(columns)}&format=${format}`);
    setExportOpen(false);
  }

  function downloadAsset(slot?: string) {
    const query = slot ? `?slot=${encodeURIComponent(slot)}` : '';
    window.location.assign(`/api/admin/registrations/${params.id}/assets${query}`);
  }

  function cancelEdit() {
    if (!detail) return;
    setEditing(false);
    setDraft(draftFromDetail(detail));
  }

  if (loading || session === null || access === null) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (readOnlyPopup) {
    return (
      <div className="grid gap-4">
        <Link href={volunteersHref} className={cn(buttonVariants({ variant: 'ghost' }), 'h-9 w-fit px-0')}>
          Back to volunteers
        </Link>
        <p className="text-sm text-muted-foreground">
          This role is read-only for volunteers. Use the popup for the key details.
        </p>
        <Button className="h-11 w-fit" onClick={() => setStaffPreviewOpen(true)}>
          View details
        </Button>
        <VolunteerPreviewDialog
          volunteerId={params.id}
          open={staffPreviewOpen}
          onOpenChange={(open) => {
            setStaffPreviewOpen(open);
            if (!open) router.replace(volunteersHref);
          }}
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <MissingVolunteer
        code="404 · Not found"
        title="This volunteer is not in the cohort"
        description="The registration may have been deleted, or the link may be incomplete. Return to the volunteer list to search again."
      >
        <Link href={volunteersHref} className={cn(buttonVariants(), 'h-11')}>
          Back to volunteers
        </Link>
      </MissingVolunteer>
    );
  }

  const cohort = detail.cohortDetail;

  const reviewNote =
    typeof detail.review_note === 'string' && detail.review_note.trim()
      ? detail.review_note.trim()
      : '';

  return (
    <div className="grid gap-4">
      {reviewNote ? (
        <div className="rounded-xl border border-[#e7c15a]/35 bg-[#e7c15a]/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#e7c15a]">Review reason</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{reviewNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={volunteersHref} className={cn(buttonVariants({ variant: 'ghost' }), 'mb-2 h-9 px-0')}>
            Back to volunteers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {String(detail.first_name ?? '')} {String(detail.last_name ?? '')}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">{detail.registration_id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          {canManage ? (
            <Button
              variant="outline"
              className="h-11"
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
          {isSuperAdmin ? (
            <Button variant="outline" className="h-11" onClick={() => downloadAsset()}>
              <Download className="size-4" />
              Download assets
            </Button>
          ) : null}
          {canUpdate ? (
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                if (editing) cancelEdit();
                else setEditing(true);
              }}
            >
              {editing ? 'Cancel edit' : 'Edit'}
            </Button>
          ) : null}
          {editing ? (
            <Button className="h-11" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
          {canManage ? (
            <Button variant="destructive" className="h-11" onClick={() => setDeleteOpen(true)}>Delete</Button>
          ) : null}
        </div>
      </div>

      {canUpdate ? (
        <Card>
          <CardHeader>
            <CardTitle>Review status</CardTitle>
            <CardDescription>
              Approve or set pending instantly. For Review or Flag, choose the status, write a reason, then submit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewStatusActions
              currentStatus={detail.status}
              onChange={setStatus}
            />
          </CardContent>
        </Card>
      ) : null}

      {cohort ? (
        <Card>
          <CardHeader>
            <CardTitle>Cohort detail</CardTitle>
            <CardDescription>Included when you export this volunteer. Edit the cohort code in the record below if needed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{cohort.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Code</p>
              <p className="font-mono text-sm">{cohort.code || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium">{cohort.status || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="font-medium">{cohort.capacity ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Venue</p>
              <p className="font-medium">{cohort.venue || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Starts</p>
              <p className="font-medium">{cohort.startsOn || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ends</p>
              <p className="font-medium">{cohort.endsOn || '—'}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="font-medium">{cohort.description || '—'}</p>
            </div>
            {cohort.id ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <Link href={href(`/admin/cohorts/${cohort.id}`)} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
                  Open cohort
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Photos & files</CardTitle>
            <CardDescription>Upload or replace any file anytime. Changes save immediately. Max {MAX_UPLOAD_LABEL}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {IMAGE_SLOTS.map((slot) => (
              <ImageEditor
                key={slot.key}
                label={slot.label}
                url={detail[slot.urlKey]}
                accept={slot.accept}
                hint={slot.requiredHint}
                busy={Boolean(imageBusy[slot.key])}
                onDownload={detail[slot.urlKey] ? () => downloadAsset(slot.key) : undefined}
                onUpload={async (file) => {
                  try {
                    await uploadImage(slot.key, file);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Could not update the file.');
                    throw error;
                  }
                }}
                onRemove={async () => {
                  try {
                    await removeImage(slot.key);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Could not remove the file.');
                  }
                }}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volunteer record</CardTitle>
            <CardDescription>{editing ? 'Every field below is editable.' : 'Open Edit to change text fields. Photos can be updated on the left anytime.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FIELD_ROWS.map((row) => {
                  const currentSector = editing ? draft.sector : String(detail.sector ?? '');
                  if (row.key === 'health_subsectors' && currentSector !== 'Health') return null;
                  const kind = row.kind ?? 'text';
                  const editingField = editing && kind !== 'readonly';
                  const amharicParts = splitAmharicName(detail.full_name_amharic);
                  const viewValue =
                    row.key === 'amharic_first' || row.key === 'amharic_middle' || row.key === 'amharic_last'
                      ? amharicParts[row.key]
                      : detail[row.key];
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium whitespace-normal">{row.label}</TableCell>
                      <TableCell className="whitespace-normal">
                        {editingField && kind === 'select' ? (
                          <select
                            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={draft[row.key] ?? ''}
                            onChange={(event) => {
                              const next = event.target.value;
                              setDraft((current) => ({
                                ...current,
                                [row.key]: next,
                                ...(row.key === 'sector' && next !== 'Health' ? { health_subsectors: '' } : {}),
                              }));
                            }}
                          >
                            {(row.options ?? []).map((option) => (
                              <option key={option || '__empty'} value={option}>
                                {option || '—'}
                              </option>
                            ))}
                          </select>
                        ) : editingField && kind === 'boolean' ? (
                          <select
                            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={draft[row.key] ?? 'false'}
                            onChange={(event) => setDraft((current) => ({ ...current, [row.key]: event.target.value }))}
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : editingField && kind === 'textarea' ? (
                          <textarea
                            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={draft[row.key] ?? ''}
                            onChange={(event) => setDraft((current) => ({ ...current, [row.key]: event.target.value }))}
                          />
                        ) : editingField ? (
                          <Input
                            className="h-11"
                            type={kind === 'number' ? 'number' : 'text'}
                            value={draft[row.key] ?? ''}
                            onChange={(event) => setDraft((current) => ({ ...current, [row.key]: event.target.value }))}
                          />
                        ) : (
                          displayValue(viewValue)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="font-medium">Languages</TableCell>
                  <TableCell className="whitespace-normal">
                    {editing ? (
                      <div className="grid gap-1">
                        <Input
                          className="h-11"
                          value={draft.languages ?? ''}
                          onChange={(event) => setDraft((current) => ({ ...current, languages: event.target.value }))}
                          placeholder="Amharic (Native), English (Fluent)"
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated: Language (Proficiency)</p>
                      </div>
                    ) : (
                      (detail.registration_languages ?? [])
                        .map((item) => `${item.language} (${item.proficiency})`)
                        .join(', ') || '—'
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ExportColumnsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedColumns={selectedColumns}
        onSelectedColumnsChange={setSelectedColumns}
        includeAssets
        title="Export this volunteer"
        description="Choose columns, then download Excel or CSV for this registration."
        onExport={exportVolunteer}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this volunteer?</DialogTitle>
            <DialogDescription>This removes the CPHIA-26 registration permanently.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void removeVolunteer()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VolunteerDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <VolunteerDetailPageInner />
    </Suspense>
  );
}
