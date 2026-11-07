'use client';

import { useState } from 'react';
import type { AdminStatus } from '@/app/lib/admin/status';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const NEEDS_REASON: AdminStatus[] = ['flagged', 'review'];

export function ReviewStatusActions({
  currentStatus,
  currentNote = '',
  onChange,
  className,
  compact = false,
}: {
  currentStatus?: AdminStatus | null;
  currentNote?: string;
  onChange: (status: AdminStatus, reason: string) => Promise<void> | void;
  className?: string;
  compact?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState<AdminStatus | null>(null);

  async function apply(status: AdminStatus) {
    const trimmed = reason.trim();
    if (NEEDS_REASON.includes(status) && !trimmed) {
      toast.error('Add a reason for review or flag.');
      return;
    }
    setSaving(status);
    try {
      await onChange(status, trimmed);
      setReason('');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
        <Button
          size={compact ? 'sm' : 'default'}
          variant="secondary"
          className={compact ? undefined : 'h-11'}
          disabled={Boolean(saving) || currentStatus === 'approved'}
          onClick={() => void apply('approved')}
        >
          {saving === 'approved' ? 'Saving…' : 'Approve'}
        </Button>
        <Button
          size={compact ? 'sm' : 'default'}
          variant="outline"
          className={compact ? undefined : 'h-11'}
          disabled={Boolean(saving) || currentStatus === 'pending'}
          onClick={() => void apply('pending')}
        >
          {saving === 'pending' ? 'Saving…' : 'Pending'}
        </Button>
        <Button
          size={compact ? 'sm' : 'default'}
          variant="outline"
          className={compact ? undefined : 'h-11'}
          disabled={Boolean(saving)}
          onClick={() => void apply('review')}
        >
          {saving === 'review' ? 'Saving…' : 'Review'}
        </Button>
        <Button
          size={compact ? 'sm' : 'default'}
          variant="outline"
          className={compact ? undefined : 'h-11'}
          disabled={Boolean(saving)}
          onClick={() => void apply('flagged')}
        >
          {saving === 'flagged' ? 'Saving…' : 'Flag'}
        </Button>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="inline-review-reason" className="text-xs text-muted-foreground">
          Reason for review / flag {currentNote ? '(previous note kept until you save a new one)' : ''}
        </Label>
        <textarea
          id="inline-review-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={compact ? 2 : 3}
          placeholder="Required when setting Review or Flag"
          className={cn(
            'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus-visible:border-[#e7c15a]/50',
            compact && 'rounded-md',
          )}
        />
        {currentNote ? (
          <p className="text-xs text-muted-foreground">
            Previous: <span className="text-foreground/80">{currentNote}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
