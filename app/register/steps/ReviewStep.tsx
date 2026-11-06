'use client';

import type { UseFormReturn } from 'react-hook-form';
import { VolunteerIdCard } from '@/components/register/volunteer-id-card';
import { ReviewSection } from '../components/ui';
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}

export function ReviewStep({
  form,
  photoUrl,
  serverError,
  onEdit,
}: {
  form: UseFormReturn<RegisterFormValues>;
  photoUrl: string | null;
  serverError: string | null;
  isSubmitting: boolean;
  onEdit: (step: number) => void;
  onSubmit: () => void;
}) {
  const values = form.watch();
  const t = getRegisterTranslations(values.uiLanguage);
  const badge = badgeFromForm(values);
  const fullName = `${values.firstName} ${values.middleName} ${values.lastName}`.replace(/\s+/g, ' ').trim();
  const languages = values.languages
    .filter((item) => item.selected && item.language.trim())
    .map((item) => `${item.language} (${item.proficiency})`)
    .join(', ');
  const health = values.healthSubsectors[0] ?? '';

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="m-0 text-xl font-semibold">{t('step4')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('reviewIntro')}</p>
      </div>

      {serverError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">
          {serverError}
        </div>
      ) : null}

      <ReviewSection title={t('reviewPersonal')} editLabel={t('editSection')} onEdit={() => onEdit(1)}>
        <dl className="m-0">
          <Row label={t('form.firstName')} value={fullName} />
          <Row label={t('form.sex')} value={values.sex} />
          <Row label={t('form.age')} value={String(values.age || '')} />
          <Row label={t('form.nationality')} value={values.nationality} />
          <Row label={t('form.fan')} value={values.fanNumber} />
          <Row label={t('form.residenceRegion')} value={`${values.residenceRegion}, ${values.residenceCity}`} />
          <Row label={t('form.residenceDetail')} value={values.residenceDetail} />
        </dl>
      </ReviewSection>

      <ReviewSection title={t('reviewContact')} editLabel={t('editSection')} onEdit={() => onEdit(1)}>
        <dl className="m-0">
          <Row label={t('form.phone')} value={values.phone} />
          <Row label={t('form.secondaryPhone')} value={values.secondaryPhone} />
          <Row label={t('form.email')} value={values.email} />
          <Row
            label={t('form.whatsapp')}
            value={values.whatsappNo ? t('form.whatsappNone') : values.phoneIsWhatsApp ? values.phone : values.whatsappNumber}
          />
        </dl>
      </ReviewSection>

      <ReviewSection title={t('reviewBackground')} editLabel={t('editSection')} onEdit={() => onEdit(2)}>
        <dl className="m-0">
          <Row label={t('form.profession')} value={values.profession} />
          <Row label={t('form.education')} value={values.educationLevel} />
          <Row label={t('form.emergencyName')} value={values.emergencyName} />
          <Row label={t('form.emergencyPhone')} value={values.emergencyPhone} />
          <Row label={t('form.language')} value={languages} />
        </dl>
      </ReviewSection>

      <ReviewSection title={t('reviewSectorBank')} editLabel={t('editSection')} onEdit={() => onEdit(3)}>
        <dl className="m-0">
          <Row label={t('form.sector')} value={health ? `${values.sector} · ${health}` : values.sector} />
          <Row label={t('form.bank')} value={values.bankName} />
          <Row label={t('form.bankAccountName')} value={values.bankAccountName} />
          <Row label={t('form.bankAccountNumber')} value={values.bankAccountNumber} />
          <Row label={t('form.ureport')} value={values.ureportRegistered ? t('form.yes') : t('form.no')} />
        </dl>
      </ReviewSection>

      <div className="grid gap-2">
        <h3 className="m-0 text-base font-semibold">{t('reviewIdPreview')}</h3>
        <VolunteerIdCard
          badge={badge}
          photoUrl={photoUrl}
          onEdit={() => onEdit(1)}
          onDownload={() => void downloadIdAsImage(badge, photoUrl)}
        />
      </div>
    </div>
  );
}
