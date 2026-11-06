"use client";

import type { UseFormReturn } from 'react-hook-form';
import { VolunteerIdCard } from '@/components/register/volunteer-id-card';
import { getRegisterTranslations } from '../i18n';
import type { VolunteerBadge } from '../lib/badge';
import { downloadIdAsImage } from '../lib/canvasDownload';
import type { RegisterFormValues } from '../types';

export function badgeFromForm(values: RegisterFormValues, registrationId = 'ID pending'): VolunteerBadge {
  return {
    registrationId,
    name: `${values.firstName} ${values.middleName} ${values.lastName}`.replace(/\s+/g, ' ').trim(),
    amharicName: values.fullNameAmharic,
    sex: values.sex,
    age: String(values.age || ''),
    nationality: values.nationality,
    fanNumber: values.fanNumber,
    phone: values.phone,
    sector: values.sector,
    profession: values.profession,
    residence: `${values.residenceRegion} / ${values.residenceCity} / ${values.residenceDetail}`,
    languages: values.languages
      .filter((item) => item.selected && item.language.trim())
      .map((item) => `${item.language} (${item.proficiency})`)
      .join(', '),
  };
}

export function ReviewStep({
  form,
  photoUrl,
  ureportUrl,
  serverError,
  onEdit,
}: {
  form: UseFormReturn<RegisterFormValues>;
  photoUrl: string | null;
  ureportUrl: string | null;
  serverError: string | null;
  isSubmitting: boolean;
  onEdit: (step: number) => void;
  onSubmit: () => void;
}) {
  const values = form.watch();
  const t = getRegisterTranslations(values.uiLanguage);
  const badge = badgeFromForm(values);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="m-0 text-xl font-semibold">{t('step4')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">This is the volunteer ID that will be used at the event. Check every detail before you submit.</p>
      </div>
      <VolunteerIdCard
        badge={badge}
        photoUrl={photoUrl}
        ureportUrl={ureportUrl}
        onEdit={() => onEdit(1)}
        onDownload={() => void downloadIdAsImage(badge, photoUrl, ureportUrl)}
      />
      {serverError ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">{serverError}</div> : null}
    </div>
  );
}
