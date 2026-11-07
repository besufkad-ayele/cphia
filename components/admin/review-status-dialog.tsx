'use client';

import { useEffect, useState } from 'react';
import { ADMIN_STATUSES, type AdminStatus } from '@/app/lib/admin/status';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const STATUS_HELP: Record<AdminStatus, string> = {
  pending: 'Back to the queue. Useful if an approval was premature.',
  approved: 'Cleared for shifts and attendance.',
  review: 'Needs another look — note what is missing or unclear.',
  flagged: 'Problem found — note what is wrong so the next reviewer knows.',
};

export function ReviewStatusDialog({
  open,
  onOpenChange,
  currentStatus,
  initialStatus,
  currentNote = '',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus?: AdminStatus | null;
  initialStatus?: AdminStatus | null;
  currentNote?: string;
  onConfirm: (status: AdminStatus, reason: string) => Promise<void> | void;
}) {
  const [status, setStatus] = useState<AdminStatus>(initialStatus || currentStatus || 'pending');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(initialStatus || currentStatus || 'pending');
    setReason('');
    setSaving(false);
  }, [open, initialStatus, currentStatus]);

  const reasonRequired = status === 'flagged' || status === 'review';

  async function submit() {
    const trimmed = reason.trim();
    if (reasonRequired && !trimmed) return;
    setSaving(true);
    try {
      await onConfirm(status, trimmed);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change review status</DialogTitle>
          <DialogDescription>
            Pick any status. Add a reason so later reviewers know what happened.
            {currentNote ? ' The previous note is shown below.' : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {currentNote ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Previous note</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{currentNote}</p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="review-status">Status</Label>
            <select
              id="review-status"
              className="flex h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus-visible:border-[#e7c15a]/50"
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminStatus)}
            >
              {ADMIN_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                  {item === currentStatus ? ' (current)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{STATUS_HELP[status]}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="review-reason">
              Reason {reasonRequired ? <span className="text-[#e7c15a]">(required)</span> : <span className="text-muted-foreground">(optional)</span>}
            </Label>
            <textarea
              id="review-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder={
                status === 'flagged'
                  ? 'e.g. FAN photo unreadable, bank account name mismatch…'
                  : status === 'review'
                    ? 'e.g. Waiting for clearer ID back photo…'
                    : 'Optional note for the record'
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus-visible:border-[#e7c15a]/50"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || (reasonRequired && !reason.trim())}
          >
            {saving ? 'Saving…' : `Set ${status}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
