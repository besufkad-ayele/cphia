'use client';

import { useEffect, useState } from 'react';
import { STAFF_PREVIEW_FIELDS } from '@/app/lib/admin/types';
import type { AdminStatus } from '@/app/lib/admin/status';
import { ReviewStatusDialog } from '@/components/admin/review-status-dialog';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { isPdfUrl } from '@/app/lib/uploads';

type PreviewDetail = Record<string, unknown> & {
  id: string;
  registration_id?: string;
  status?: AdminStatus;
  review_note?: string;
  photoUrl?: string | null;
  first_name?: string;
  last_name?: string;
};

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value == null || value === '') return '—';
  return String(value);
}

export function VolunteerPreviewDialog({
  volunteerId,
  open,
  onOpenChange,
  onStatusChange,
}: {
  volunteerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (id: string, action: AdminStatus, reason: string) => Promise<void> | void;
}) {
  const [detail, setDetail] = useState<PreviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusInitial, setStatusInitial] = useState<AdminStatus | null>(null);

  useEffect(() => {
    if (!open || !volunteerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/admin/registrations/${volunteerId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load volunteer.');
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setDetail(payload as PreviewDetail);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, volunteerId]);

  const title = detail
    ? `${String(detail.first_name ?? '')} ${String(detail.last_name ?? '')}`.trim() || 'Volunteer'
    : 'Volunteer';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Key registration details for desk staff. Full record editing is limited to super admins.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!loading && detail ? (
            <div className="grid gap-4">
              {detail.photoUrl && !isPdfUrl(detail.photoUrl) ? (
                <img
                  src={detail.photoUrl}
                  alt={title}
                  className="mx-auto h-40 w-32 rounded-xl object-cover ring-1 ring-white/10"
                />
              ) : detail.photoUrl ? (
                <a
                  href={detail.photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  Photo on file as PDF — open
                </a>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs text-muted-foreground">{detail.registration_id}</p>
                {detail.status ? <StatusBadge status={detail.status} /> : null}
              </div>

              {typeof detail.review_note === 'string' && detail.review_note.trim() ? (
                <div className="rounded-xl border border-[#e7c15a]/30 bg-[#e7c15a]/5 px-3 py-2 text-sm">
                  <p className="text-xs uppercase tracking-wide text-[#e7c15a]">Review note</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{detail.review_note}</p>
                </div>
              ) : null}

              <dl className="grid gap-2">
                {STAFF_PREVIEW_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-[140px_1fr] gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"
                  >
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="text-foreground">{displayValue(detail[field.key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {detail && onStatusChange ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusInitial(detail.status === 'approved' ? 'pending' : 'approved');
                    setStatusOpen(true);
                  }}
                >
                  {detail.status === 'approved' ? 'Set pending' : 'Approve'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusInitial(detail.status || 'pending');
                    setStatusOpen(true);
                  }}
                >
                  Change status
                </Button>
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        currentStatus={detail?.status}
        initialStatus={statusInitial}
        currentNote={typeof detail?.review_note === 'string' ? detail.review_note : ''}
        onConfirm={async (status, reason) => {
          if (!detail || !onStatusChange) return;
          await onStatusChange(detail.id, status, reason);
          setStatusOpen(false);
        }}
      />
    </>
  );
}
