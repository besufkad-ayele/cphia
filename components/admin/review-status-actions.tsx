'use client';

import { useState } from 'react';
import type { AdminStatus } from '@/app/lib/admin/status';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const REASON_STATUSES: AdminStatus[] = ['flagged', 'review'];

export function ReviewStatusActions({
  currentStatus,
  onChange,
  className,
  compact = false,
}: {
  currentStatus?: AdminStatus | null;
  onChange: (status: AdminStatus | null, reason: string) => Promise<void> | void;
  className?: string;
  compact?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<AdminStatus | null>(null);
  const [saving, setSaving] = useState(false);

  async function applyInstant(status: AdminStatus) {
    setSelected(null);
    setSaving(true);
    try {
      await onChange(status, '');
    } finally {
      setSaving(false);
    }
  }

  async function submitReason() {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error('Write a reason before submitting.');
      return;
    }
    const status = selected && REASON_STATUSES.includes(selected) ? selected : null;
    if (!status && !REASON_STATUSES.includes(currentStatus || 'pending')) {
      toast.error('Choose Review or Flag, then submit the reason.');
      return;
    }
    setSaving(true);
    try {
      await onChange(status ?? currentStatus ?? null, trimmed);
      setReason('');
      setSelected(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn('grid gap-3', className)}>
      <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
        <Button
          size={compact ? 'sm' : 'default'}
          variant="secondary"
          className={compact ? undefined : 'h-11'}
          disabled={saving || currentStatus === 'approved'}
          onClick={() => void applyInstant('approved')}
        >
          Approve
        </Button>
        <Button
          size={compact ? 'sm' : 'default'}
          variant="outline"
          className={compact ? undefined : 'h-11'}
          disabled={saving || currentStatus === 'pending'}
          onClick={() => void applyInstant('pending')}
        >
          Pending
        </Button>
        <Button
          size={compact ? 'sm' : 'default'}
          variant={selected === 'review' ? 'secondary' : 'outline'}
          className={compact ? undefined : 'h-11'}
          disabled={saving}
          onClick={() => setSelected((current) => (current === 'review' ? null : 'review'))}
        >
          Review
        </Button>
        <Button
          size={compact ? 'sm' : 'default'}
          variant={selected === 'flagged' ? 'secondary' : 'outline'}
          className={compact ? undefined : 'h-11'}
          disabled={saving}
          onClick={() => setSelected((current) => (current === 'flagged' ? null : 'flagged'))}
        >
          Flag
        </Button>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="inline-review-reason" className="text-xs text-muted-foreground">
          {selected === 'flagged'
            ? 'Reason for flag'
            : selected === 'review'
              ? 'Reason for review'
              : 'Reason (choose Review or Flag, then submit)'}
        </Label>
        <div className={cn('flex gap-2', compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row sm:items-start')}>
          <textarea
            id="inline-review-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={compact ? 2 : 3}
            placeholder="e.g. FAN photo unreadable, waiting for clearer ID…"
            className={cn(
              'min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus-visible:border-[#e7c15a]/50',
              compact && 'rounded-md',
            )}
          />
          <Button
            className={cn(compact ? 'h-9 shrink-0' : 'h-11 shrink-0', !compact && 'sm:mt-0')}
            disabled={saving || !reason.trim()}
            onClick={() => void submitReason()}
          >
            {saving ? 'Saving…' : 'Submit reason'}
          </Button>
        </div>
      </div>
    </div>
  );
}
