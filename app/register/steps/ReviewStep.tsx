"use client";

import type { UseFormReturn } from 'react-hook-form';
import { GoldButton, ReviewSection } from '../components/ui';
import { getRegisterTranslations } from '../i18n';
import type { RegisterFormValues } from '../types';

export function ReviewStep({
  form,
  photoUrl,
  serverError,
  isSubmitting,
  onEdit,
  onSubmit,
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

  return (
    <div className="grid gap-4">
      <h2 className="m-0 text-xl font-black text-black">{t('step4')}</h2>

      <ReviewSection title="Personal" onEdit={() => onEdit(1)}>
        <p><strong>Name:</strong> {values.firstName} {values.middleName} {values.lastName}</p>
        <p><strong>Amharic:</strong> {values.fullNameAmharic || '-'}</p>
        <p><strong>Sex:</strong> {values.sex || '-'}</p>
        <p><strong>Age:</strong> {values.age || '-'}</p>
        <p><strong>Nationality:</strong> {values.nationality}</p>
        <p><strong>FAN:</strong> {values.fanNumber || 'Not provided'}</p>
      </ReviewSection>

      <ReviewSection title="Contact" onEdit={() => onEdit(1)}>
        <p><strong>Phone:</strong> {values.phone}</p>
        <p><strong>WhatsApp:</strong> {values.phoneIsWhatsApp ? values.phone : values.whatsappNo ? 'No WhatsApp' : values.whatsappNumber || 'Not provided'}</p>
        <p><strong>Email:</strong> {values.email}</p>
        <p><strong>Residence:</strong> {values.residenceRegion} / {values.residenceCity} / {values.residenceDetail}</p>
      </ReviewSection>

      <ReviewSection title="Background" onEdit={() => onEdit(2)}>
        <p><strong>Profession:</strong> {values.profession}</p>
        <p><strong>Education:</strong> {values.educationLevel}</p>
        <p><strong>Emergency:</strong> {values.emergencyName} ({values.emergencyRelationship}) — {values.emergencyPhone}</p>
      </ReviewSection>

      <ReviewSection title="Languages" onEdit={() => onEdit(2)}>
        <p>{values.languages.filter((item) => item.selected && item.language.trim()).map((item) => `${item.language} (${item.proficiency})`).join(', ') || '-'}</p>
      </ReviewSection>

      <ReviewSection title="Sector" onEdit={() => onEdit(3)}>
        <p><strong>Sector:</strong> {values.sector}</p>
        <p><strong>Health sub-sectors:</strong> {values.sector === 'Health' ? values.healthSubsectors.join(', ') || '-' : 'Not applicable'}</p>
      </ReviewSection>

      {photoUrl ? (
        <ReviewSection title="Photo" onEdit={() => onEdit(1)}>
          <img src={photoUrl} alt="Uploaded photo" className="h-20 w-20 rounded-full border border-black/20 object-cover" />
        </ReviewSection>
      ) : null}

      {serverError ? <div className="rounded-[var(--radius-field)] border border-[#B42318]/40 bg-[#fff1f1] p-3 text-sm font-semibold text-[#8b1c13]">{serverError}</div> : null}

      <GoldButton type="button" onClick={onSubmit} disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t('submitting') : t('submit')}
      </GoldButton>
    </div>
  );
}
