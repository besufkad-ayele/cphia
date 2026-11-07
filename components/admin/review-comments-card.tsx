'use client';

import type { AdminStatus } from '@/app/lib/admin/status';
import { parseReviewComments, type ReviewComment } from '@/app/lib/admin/types';

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ReviewCommentsCard({
  status,
  comments,
  fallbackNote = '',
}: {
  status?: AdminStatus | string | null;
  comments?: unknown;
  fallbackNote?: string;
}) {
  if (status === 'approved') return null;

  const items: ReviewComment[] = parseReviewComments(comments);
  if (!items.length && fallbackNote.trim()) {
    items.push({
      id: 'legacy',
      at: '',
      status: typeof status === 'string' ? status : '',
      note: fallbackNote.trim(),
      actorName: '',
    });
  }
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-[#e7c15a]/35 bg-[#e7c15a]/10 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#e7c15a]">
        Review reasons ({items.length})
      </p>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-[#e7c15a]/20 bg-black/20 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {item.status ? <span className="capitalize text-[#e7c15a]">{item.status}</span> : null}
              {item.actorName ? <span>{item.actorName}</span> : null}
              {item.at ? <span>{formatWhen(item.at)}</span> : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{item.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
