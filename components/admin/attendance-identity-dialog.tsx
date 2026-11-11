'use client';

import { useEffect, useState } from 'react';
import { formatVolunteerName } from '@/app/lib/admin/types';
import type { VolunteerBadge } from '@/app/register/lib/badge';
import { isPdfUrl } from '@/app/lib/uploads';
import { ImageLightbox } from '@/components/admin/image-lightbox';
import { PinBelowHeader } from '@/components/admin/pin-below-header';
import { VolunteerIdCard } from '@/components/register/volunteer-id-card';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type LanguageRow = {
  language?: string | null;
  proficiency?: string | null;
  language_group?: string | null;
};

type IdentityDetail = {
  id: string;
  registration_id?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  full_name_amharic?: string;
  sex?: string;
  age?: number | string;
  fan_number?: string;
  phone?: string;
  secondary_phone?: string;
  email?: string;
  sector?: string;
  health_subsectors?: string[] | null;
  role_subsectors?: string[] | null;
  residence_region?: string;
  residence_detail?: string;
  profession?: string;
  nationality?: string;
  photoUrl?: string | null;
  fanPhotoUrl?: string | null;
  registration_languages?: LanguageRow[] | null;
};

function useIdentityDetail(volunteerId: string | null, active: boolean) {
  const [detail, setDetail] = useState<IdentityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !volunteerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/admin/registrations/${volunteerId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load volunteer identity.');
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setDetail(payload as IdentityDetail);
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
  }, [active, volunteerId]);

  return { detail, loading, error };
}

function useIsLargeScreen() {
  const [isLarge, setIsLarge] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLarge(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isLarge;
}

function languagesLabel(rows: LanguageRow[] | null | undefined) {
  if (!rows?.length) return '';
  return rows
    .map((row) => {
      const language = (row.language || '').trim();
      if (!language) return '';
      const proficiency = (row.proficiency || '').trim();
      return proficiency ? `${language} (${proficiency})` : language;
    })
    .filter(Boolean)
    .join(', ');
}

function toBadge(detail: IdentityDetail): VolunteerBadge {
  return {
    registrationId: detail.registration_id || '',
    name:
      formatVolunteerName({
        firstName: detail.first_name,
        middleName: detail.middle_name,
        lastName: detail.last_name,
      }) || 'Volunteer',
    amharicName: detail.full_name_amharic || '',
    sex: detail.sex || '',
    age: detail.age != null ? String(detail.age) : '',
    nationality: detail.nationality || '',
    fanNumber: detail.fan_number || '',
    phone: detail.phone || '',
    sector: detail.sector || '',
    profession: detail.profession || '',
    residence: [detail.residence_region, detail.residence_detail].filter(Boolean).join(' / '),
    languages: languagesLabel(detail.registration_languages),
  };
}

function IdentityBody({
  detail,
  loading,
  error,
  onPreviewPhoto,
}: {
  detail: IdentityDetail | null;
  loading: boolean;
  error: string | null;
  onPreviewPhoto: (src: string, alt: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!detail) return null;

  const badge = toBadge(detail);
  const photoUrl = detail.photoUrl && !isPdfUrl(detail.photoUrl) ? detail.photoUrl : null;

  return (
    <div className="grid gap-3">
      <VolunteerIdCard
        badge={badge}
        photoUrl={photoUrl}
        title="Verify against this ID"
        className="border-zinc-200 bg-white text-zinc-950 ring-black/10 [&_header]:border-zinc-200 [&_header]:bg-zinc-50 [&_footer]:border-zinc-200 [&_footer]:bg-zinc-100 [&_.text-muted-foreground]:text-zinc-500 [&_.text-primary]:text-[#1d4ed8] [&_.text-card-foreground]:text-zinc-950"
      />

      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Desk check</p>
        <p className="mt-1 break-words text-white">{detail.email || '—'}</p>
        {detail.secondary_phone ? (
          <p className="mt-0.5 text-zinc-400">Alt phone · {detail.secondary_phone}</p>
        ) : null}
        {(detail.health_subsectors?.length ?? 0) > 0 ? (
          <p className="mt-0.5 text-zinc-400">{detail.health_subsectors?.join(', ')}</p>
        ) : null}
        {(detail.role_subsectors?.length ?? 0) > 0 ? (
          <p className="mt-0.5 text-zinc-400">{detail.role_subsectors?.join(', ')}</p>
        ) : null}
      </div>

      {detail.fanPhotoUrl && !isPdfUrl(detail.fanPhotoUrl) ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">National ID front</p>
          <button
            type="button"
            className="overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:ring-[#e7c15a]/50"
            onClick={() => onPreviewPhoto(detail.fanPhotoUrl!, 'National ID front')}
          >
            <img
              src={detail.fanPhotoUrl}
              alt="National ID front"
              className="max-h-36 w-auto object-contain"
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Large screens: pinned ID panel beside the sheet list (no modal hop). */
export function AttendanceIdentityPanel({
  volunteerId,
  className,
  onClose,
}: {
  volunteerId: string | null;
  className?: string;
  onClose?: () => void;
}) {
  const active = Boolean(volunteerId);
  const { detail, loading, error } = useIdentityDetail(volunteerId, active);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  return (
    <>
      <aside
        className={cn(
          'hidden lg:block',
          className,
        )}
      >
        <PinBelowHeader
          pinId="attendance-identity"
          stackBelowPinId="attendance-toolbar"
          gap={12}
          className="grid max-h-[calc(100dvh-5.5rem)] gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(8,8,10,0.96)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#e7c15a]">Identity</p>
              <p className="mt-1 text-sm text-zinc-400">
                {volunteerId
                  ? 'Match the person in front of you to this ID, then mark status.'
                  : 'Tap a name in the list to open their volunteer ID here.'}
              </p>
            </div>
            {volunteerId && onClose ? (
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                Clear
              </Button>
            ) : null}
          </div>

          {!volunteerId ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 px-4 py-16 text-center text-sm text-zinc-500">
              No volunteer selected
            </div>
          ) : (
            <IdentityBody
              detail={detail}
              loading={loading}
              error={error}
              onPreviewPhoto={(src, alt) => setLightbox({ src, alt })}
            />
          )}
        </PinBelowHeader>
      </aside>
      <ImageLightbox
        open={Boolean(lightbox)}
        src={lightbox?.src ?? null}
        alt={lightbox?.alt}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

/** Mobile / tablet: bottom sheet with the same ID card. */
export function AttendanceIdentitySheet({
  volunteerId,
  open,
  onOpenChange,
}: {
  volunteerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isLarge = useIsLargeScreen();
  // Wait until breakpoint is known so desktop never flashes a bottom sheet.
  const sheetOpen = open && isLarge === false;
  const { detail, loading, error } = useIdentityDetail(volunteerId, sheetOpen);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[88vh] gap-0 overflow-y-auto rounded-t-2xl border-white/10 bg-zinc-950 p-0 pb-[calc(1rem+env(safe-area-inset-bottom))] text-zinc-100"
        >
          <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 px-4 pb-3 pt-3 backdrop-blur">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" aria-hidden />
            <SheetHeader className="p-0 text-left">
              <SheetTitle className="text-white">Verify identity</SheetTitle>
              <SheetDescription className="text-zinc-400">
                Match the person in front of you to this volunteer ID before marking attendance.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="grid gap-3 p-4">
            <IdentityBody
              detail={detail}
              loading={loading}
              error={error}
              onPreviewPhoto={(src, alt) => setLightbox({ src, alt })}
            />
          </div>

          <SheetFooter className="border-t border-white/10 p-4">
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ImageLightbox
        open={Boolean(lightbox)}
        src={lightbox?.src ?? null}
        alt={lightbox?.alt}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

/** @deprecated Prefer AttendanceIdentityPanel + AttendanceIdentitySheet */
export function AttendanceIdentityDialog({
  volunteerId,
  open,
  onOpenChange,
}: {
  volunteerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AttendanceIdentitySheet
      volunteerId={volunteerId}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
