'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AdminStatus } from '@/app/lib/admin/status';
import { StatusBadge } from '@/components/admin/status-badge';
import { href } from '@/lib/app-href';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AdminStatus as MissingVolunteer } from '@/components/status/admin-status';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Detail = Record<string, unknown> & {
  id: string;
  registration_id: string;
  status: AdminStatus;
  photoUrl?: string | null;
  ureportUrl?: string | null;
  fanPhotoUrl?: string | null;
  secondIdPhotoUrl?: string | null;
  bankOwnerIdPhotoUrl?: string | null;
  registration_languages?: Array<{ language: string; proficiency: string; language_group?: string }>;
};

const FIELD_ROWS: Array<{ key: string; label: string; editable?: boolean }> = [
  { key: 'registration_id', label: 'Registration ID' },
  { key: 'cohort', label: 'Cohort' },
  { key: 'first_name', label: 'First name', editable: true },
  { key: 'middle_name', label: 'Middle name', editable: true },
  { key: 'last_name', label: 'Last name', editable: true },
  { key: 'full_name_amharic', label: 'Full name (Amharic)', editable: true },
  { key: 'sex', label: 'Sex', editable: true },
  { key: 'age', label: 'Age', editable: true },
  { key: 'nationality', label: 'Nationality', editable: true },
  { key: 'fan_number', label: 'FAN number', editable: true },
  { key: 'second_id_type', label: 'Second ID type' },
  { key: 'second_id_number', label: 'Second ID number' },
  { key: 'phone', label: 'Phone', editable: true },
  { key: 'secondary_phone', label: 'Secondary phone', editable: true },
  { key: 'whatsapp_number', label: 'WhatsApp' },
  { key: 'email', label: 'Email', editable: true },
  { key: 'residence_region', label: 'Region', editable: true },
  { key: 'residence_detail', label: 'Residence detail', editable: true },
  { key: 'profession', label: 'Profession', editable: true },
  { key: 'education_level', label: 'Education', editable: true },
  { key: 'emergency_name', label: 'Emergency name', editable: true },
  { key: 'emergency_phone', label: 'Emergency phone', editable: true },
  { key: 'emergency_relationship', label: 'Emergency relationship', editable: true },
  { key: 'sector', label: 'Sector', editable: true },
  { key: 'health_subsectors', label: 'Health sub-sector' },
  { key: 'bank_name', label: 'Bank', editable: true },
  { key: 'bank_account_name', label: 'Account owner name', editable: true },
  { key: 'bank_account_number', label: 'Account number', editable: true },
  { key: 'bank_account_other_owner', label: 'Account owned by someone else' },
  { key: 'ureport_registered', label: 'U-Report registered' },
  { key: 'review_status', label: 'Review status' },
  { key: 'created_at', label: 'Submitted' },
];

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value == null || value === '') return '—';
  return String(value);
}

export default function VolunteerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    const next: Record<string, string> = {};
    for (const row of FIELD_ROWS) {
      if (row.editable) next[row.key] = payload[row.key] == null ? '' : String(payload[row.key]);
    }
    setDraft(next);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function save() {
    const response = await fetch(`/api/admin/registrations/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      toast.error('Could not save changes.');
      return;
    }
    toast.success('Volunteer updated.');
    setEditing(false);
    void load();
  }

  async function setStatus(action: AdminStatus) {
    const response = await fetch(`/api/admin/registrations/${params.id}`, {
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
    const response = await fetch(`/api/admin/registrations/${params.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Could not delete volunteer.');
      return;
    }
    toast.success('Volunteer deleted.');
    router.replace(href('/admin/volunteers'));
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
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
        <Link href={href('/admin/volunteers')} className={cn(buttonVariants(), 'h-11')}>
          Back to volunteers
        </Link>
      </MissingVolunteer>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={href('/admin/volunteers')} className={cn(buttonVariants({ variant: 'ghost' }), 'mb-2 h-9 px-0')}>
            Back to volunteers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {String(detail.first_name ?? '')} {String(detail.last_name ?? '')}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">{detail.registration_id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          <Button variant="outline" className="h-11" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Cancel edit' : 'Edit'}
          </Button>
          {editing ? <Button className="h-11" onClick={() => void save()}>Save</Button> : null}
          <Button variant="secondary" className="h-11" onClick={() => void setStatus('approved')}>Approve</Button>
          <Button variant="outline" className="h-11" onClick={() => void setStatus('review')}>Review</Button>
          <Button variant="outline" className="h-11" onClick={() => void setStatus('flagged')}>Flag</Button>
          <Button variant="destructive" className="h-11" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Photo</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.photoUrl ? (
              <img src={detail.photoUrl} alt="Volunteer" className="w-full rounded-lg object-cover" />
            ) : (
              <p className="text-sm text-muted-foreground">No photo</p>
            )}
            {detail.fanPhotoUrl ? (
              <div className="mt-4">
                <Label>National ID</Label>
                <img src={detail.fanPhotoUrl} alt="National ID" className="mt-2 w-full rounded-lg object-cover" />
              </div>
            ) : null}
            {detail.secondIdPhotoUrl ? (
              <div className="mt-4">
                <Label>Second ID</Label>
                <img src={detail.secondIdPhotoUrl} alt="Second ID" className="mt-2 w-full rounded-lg object-cover" />
              </div>
            ) : null}
            {detail.bankOwnerIdPhotoUrl ? (
              <div className="mt-4">
                <Label>Account owner ID</Label>
                <img src={detail.bankOwnerIdPhotoUrl} alt="Account owner ID" className="mt-2 w-full rounded-lg object-cover" />
              </div>
            ) : null}
            {detail.ureportUrl ? (
              <div className="mt-4">
                <Label>U-Report screenshot</Label>
                <img src={detail.ureportUrl} alt="U-Report" className="mt-2 w-full rounded-lg object-cover" />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volunteer record</CardTitle>
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
                {FIELD_ROWS.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium whitespace-normal">{row.label}</TableCell>
                    <TableCell className="whitespace-normal">
                      {editing && row.editable ? (
                        <Input
                          className="h-11"
                          value={draft[row.key] ?? ''}
                          onChange={(event) => setDraft((current) => ({ ...current, [row.key]: event.target.value }))}
                        />
                      ) : (
                        displayValue(detail[row.key])
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium">Languages</TableCell>
                  <TableCell className="whitespace-normal">
                    {(detail.registration_languages ?? [])
                      .map((item) => `${item.language} (${item.proficiency})`)
                      .join(', ') || '—'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

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
