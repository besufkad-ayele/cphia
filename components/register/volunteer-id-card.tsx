'use client';

import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CphiaLogo } from '@/components/brand/cphia-logo';
import type { VolunteerBadge } from '@/app/register/lib/badge';

export function VolunteerIdCard({
  badge,
  photoUrl,
  title,
  onEdit,
  onDownload,
  onCopy,
  onShare,
}: {
  badge: VolunteerBadge;
  photoUrl: string | null;
  title?: string;
  onEdit?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm ring-1 ring-foreground/10">
      <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div className="grid gap-1">
          <CphiaLogo className="h-10 w-auto max-w-[190px] object-contain object-left" />
          <p className="text-xs font-medium text-muted-foreground">Facility Volunteer ID</p>
        </div>
        {onEdit ? (
          <Button type="button" variant="outline" className="h-10" onClick={onEdit}>Edit</Button>
        ) : null}
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-[132px_1fr]">
        <div className="grid justify-items-center gap-2">
          {photoUrl ? (
            <img src={photoUrl} alt={badge.name} className="h-40 w-[110px] rounded-md border object-cover object-top" />
          ) : (
            <div className="grid h-40 w-[110px] place-items-center rounded-md border bg-muted text-muted-foreground">
              <User className="size-6" />
            </div>
          )}
          <p className="text-center text-[11px] text-muted-foreground">Event ID photo</p>
        </div>
        <div className="grid gap-1">
          {title ? <p className="text-xs font-semibold text-primary">{title}</p> : null}
          <h2 className="text-2xl font-semibold tracking-tight">{badge.name || 'Volunteer'}</h2>
          {badge.amharicName ? <p className="text-sm text-muted-foreground">{badge.amharicName}</p> : null}
          <p className="font-mono text-lg font-semibold text-primary">{badge.registrationId || 'ID pending'}</p>
          <p className="text-sm">{[badge.sector, badge.sex, badge.age ? `${badge.age} yrs` : ''].filter(Boolean).join(' · ')}</p>
          <p className="text-sm text-muted-foreground">{badge.profession}</p>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">FAN</dt><dd className="font-mono">{badge.fanNumber || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Phone</dt><dd>{badge.phone || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nationality</dt><dd>{badge.nationality || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Residence</dt><dd className="text-right">{badge.residence || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Languages</dt><dd className="text-right">{badge.languages || '—'}</dd></div>
          </dl>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-4 py-3">
        <p className="text-xs text-muted-foreground">Keep this ID for check-in and training days.</p>
        <div className="flex flex-wrap gap-2">
          {onCopy ? <Button type="button" variant="outline" className="h-10" onClick={onCopy}>Copy ID</Button> : null}
          {onDownload ? <Button type="button" className="h-10" onClick={onDownload}>Download ID</Button> : null}
          {onShare ? <Button type="button" variant="outline" className="h-10" onClick={onShare}>Share</Button> : null}
        </div>
      </footer>
    </article>
  );
}
