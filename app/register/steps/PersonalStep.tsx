"use client";

import type { UseFormReturn } from 'react-hook-form';
import {
  Field,
  PhoneInput,
  PhotoUpload,
  RadioCard,
  SegmentedControl,
} from '../components/ui';
import {
  nationalityOptions,
  regionOptions,
  secondIdTypeOptions,
} from '../constants';
import { getRegisterTranslations } from '../i18n';
import type { RegisterFormValues, StoredPhoto } from '../types';

export function PersonalStep({
  form,
  photo,
  photoUrl,
  photoError,
  showSecondId,
  onToggleSecondId,
  onTakePhoto,
  onChoosePhoto,
  onRemovePhoto,
  takePhotoRef,
  choosePhotoRef,
  onUploadPhoto,
}: {
  form: UseFormReturn<RegisterFormValues>;
  photo: StoredPhoto | null;
  photoUrl: string | null;
  photoError: string | null;
  showSecondId: boolean;
  onToggleSecondId: () => void;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onRemovePhoto: () => void;
  takePhotoRef: React.RefObject<HTMLInputElement | null>;
  choosePhotoRef: React.RefObject<HTMLInputElement | null>;
  onUploadPhoto: (file: File | null) => void;
}) {
  const values = form.watch();
  const t = getRegisterTranslations(values.uiLanguage);
  const emailMatches = values.email.trim().length > 0 && values.email.trim() === values.confirmEmail.trim();

  const formatFan = (raw: string) => raw.replace(/\D/g, '').slice(0, 20).replace(/(.{4})/g, '$1 ').trim();

  const setAmharicName = (field: 'amharicFirstName' | 'amharicMiddleName' | 'amharicLastName', value: string) => {
    form.setValue(field, value, { shouldDirty: true, shouldValidate: true });
    const next = { ...form.getValues(), [field]: value };
    form.setValue(
      'fullNameAmharic',
      [next.amharicFirstName, next.amharicMiddleName, next.amharicLastName].filter(Boolean).join(' ').trim(),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <div className="grid gap-4">
      <h2 className="m-0 text-xl font-black text-black">{t('step1')}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="firstName" label={t('form.firstName')} error={form.formState.errors.firstName?.message}>
          <input id="firstName" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.firstName} onChange={(e) => form.setValue('firstName', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" autoComplete="given-name" enterKeyHint="next" />
        </Field>
        <Field id="middleName" label={t('form.middleName')}>
          <input id="middleName" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.middleName} onChange={(e) => form.setValue('middleName', e.target.value, { shouldDirty: true })} autoCapitalize="words" autoComplete="additional-name" enterKeyHint="next" />
        </Field>
        <Field id="lastName" label={t('form.lastName')} error={form.formState.errors.lastName?.message}>
          <input id="lastName" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.lastName} onChange={(e) => form.setValue('lastName', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" autoComplete="family-name" enterKeyHint="next" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="amharicFirstName" label={t('form.amharicFirst')} error={form.formState.errors.amharicFirstName?.message}>
          <input id="amharicFirstName" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.amharicFirstName} onChange={(e) => setAmharicName('amharicFirstName', e.target.value)} />
        </Field>
        <Field id="amharicMiddleName" label={t('form.amharicMiddle')}>
          <input id="amharicMiddleName" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.amharicMiddleName} onChange={(e) => setAmharicName('amharicMiddleName', e.target.value)} />
        </Field>
        <Field id="amharicLastName" label={t('form.amharicLast')} error={form.formState.errors.amharicLastName?.message}>
          <input id="amharicLastName" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.amharicLastName} onChange={(e) => setAmharicName('amharicLastName', e.target.value)} />
        </Field>
      </div>

      <Field id="sex" label={t('form.sex')} error={form.formState.errors.sex?.message}>
        <SegmentedControl name="sex" value={values.sex} options={['Male', 'Female']} onChange={(value) => form.setValue('sex', value as RegisterFormValues['sex'], { shouldValidate: true, shouldDirty: true })} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="age" label={t('form.age')} error={form.formState.errors.age?.message}>
          <input
            id="age"
            value={values.age}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
              form.setValue('age', digits === '' ? '' : Number(digits), { shouldDirty: true, shouldValidate: true });
            }}
            className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3"
            inputMode="numeric"
            min={18}
            max={70}
            enterKeyHint="next"
          />
        </Field>
        <Field id="nationality" label={t('form.nationality')} error={form.formState.errors.nationality?.message}>
          <select
            id="nationality"
            value={values.nationality}
            onChange={(event) => form.setValue('nationality', event.target.value, { shouldDirty: true, shouldValidate: true })}
            className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 bg-white px-3 text-black"
          >
            <option value="">Select nationality</option>
            {nationalityOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field id="fanNumber" label={t('form.fan')} hint={t('form.fanHint')} error={form.formState.errors.fanNumber?.message}>
          <input id="fanNumber" value={formatFan(values.fanNumber)} onChange={(e) => form.setValue('fanNumber', formatFan(e.target.value), { shouldDirty: true, shouldValidate: true })} className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" inputMode="numeric" enterKeyHint="next" />
        </Field>
      </div>

      <button type="button" className="focus-ring w-fit min-h-12 rounded-full border border-black/20 px-4 text-sm font-bold text-black" onClick={onToggleSecondId}>Add another ID</button>
      {showSecondId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="secondIdType" label={t('form.secondIdType')}>
            <select id="secondIdType" value={values.secondIdType} onChange={(e) => form.setValue('secondIdType', e.target.value as RegisterFormValues['secondIdType'], { shouldDirty: true })} className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3">
              <option value="">Select</option>
              {secondIdTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field id="secondIdNumber" label={t('form.secondIdNumber')}>
            <input id="secondIdNumber" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.secondIdNumber} onChange={(e) => form.setValue('secondIdNumber', e.target.value, { shouldDirty: true })} />
          </Field>
        </div>
      ) : null}

      <Field id="photo" label={t('form.photo')} error={photoError ?? undefined}>
        <PhotoUpload
          photoUrl={photoUrl}
          photoName={photo?.fileName}
          sizeLabel={photo ? `${Math.round(photo.size / 1024)} KB` : undefined}
          onTake={onTakePhoto}
          onChoose={onChoosePhoto}
          onRemove={onRemovePhoto}
        />
        <input ref={takePhotoRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => onUploadPhoto(e.target.files?.[0] ?? null)} />
        <input ref={choosePhotoRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onUploadPhoto(e.target.files?.[0] ?? null)} />
      </Field>

      <Field id="phone" label={t('form.phone')} error={form.formState.errors.phone?.message}>
        <PhoneInput id="phone" value={values.phone} onChange={(value) => form.setValue('phone', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.phone?.message} />
      </Field>

      <Field id="phoneIsWhatsApp" label={t('form.whatsappSame')} error={form.formState.errors.phoneIsWhatsApp?.message}>
        <div className="grid gap-2 sm:grid-cols-2">
          <RadioCard checked={values.phoneIsWhatsApp === true} label={t('form.yes')} onClick={() => form.setValue('phoneIsWhatsApp', true, { shouldDirty: true, shouldValidate: true })} />
          <RadioCard checked={values.phoneIsWhatsApp === false} label={t('form.no')} onClick={() => form.setValue('phoneIsWhatsApp', false, { shouldDirty: true, shouldValidate: true })} />
        </div>
      </Field>

      {values.phoneIsWhatsApp === false ? (
        <div className="grid gap-3">
          <Field id="whatsappNumber" label={t('form.whatsapp')} error={form.formState.errors.whatsappNumber?.message}>
            <PhoneInput id="whatsappNumber" value={values.whatsappNumber} onChange={(value) => form.setValue('whatsappNumber', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.whatsappNumber?.message} />
          </Field>
          <label className="flex min-h-12 items-center gap-2 rounded-[var(--radius-field)] border border-black/20 px-3 text-sm font-semibold text-black">
            <input type="checkbox" checked={values.whatsappNo} onChange={(e) => form.setValue('whatsappNo', e.target.checked, { shouldDirty: true, shouldValidate: true })} />
            {t('form.whatsappNone')}
          </label>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="email" label={t('form.email')} error={form.formState.errors.email?.message}>
          <input id="email" value={values.email} onChange={(e) => form.setValue('email', e.target.value, { shouldDirty: true, shouldValidate: true })} className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" autoComplete="email" inputMode="email" enterKeyHint="next" />
        </Field>
        <Field id="confirmEmail" label={t('form.confirmEmail')} error={form.formState.errors.confirmEmail?.message}>
          <input id="confirmEmail" value={values.confirmEmail} onPaste={(e) => e.preventDefault()} onChange={(e) => form.setValue('confirmEmail', e.target.value, { shouldDirty: true, shouldValidate: true })} className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" autoComplete="off" inputMode="email" enterKeyHint="next" />
        </Field>
      </div>
      {values.confirmEmail ? <p className={`m-0 text-sm font-semibold ${emailMatches ? 'text-[#067647]' : 'text-[#B42318]'}`}>{emailMatches ? '✓ Emails match' : '⚠ Emails do not match'}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="residenceRegion" label={t('form.residenceRegion')} error={form.formState.errors.residenceRegion?.message}>
          <select id="residenceRegion" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.residenceRegion} onChange={(e) => form.setValue('residenceRegion', e.target.value, { shouldDirty: true, shouldValidate: true })}>
            <option value="">Select</option>
            {regionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </Field>
        <Field id="residenceCity" label={t('form.residenceCity')} error={form.formState.errors.residenceCity?.message}>
          <input id="residenceCity" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.residenceCity} onChange={(e) => form.setValue('residenceCity', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" />
        </Field>
        <Field id="residenceDetail" label={t('form.residenceDetail')} error={form.formState.errors.residenceDetail?.message}>
          <input id="residenceDetail" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.residenceDetail} onChange={(e) => form.setValue('residenceDetail', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" />
        </Field>
      </div>
    </div>
  );
}
