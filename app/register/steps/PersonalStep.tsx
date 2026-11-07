"use client";

import type { UseFormReturn } from 'react-hook-form';
import { Check, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fieldClass, Field, PhoneInput, RadioCard, SegmentedControl } from '../components/ui';
import { ImageField } from '../components/image-field';
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
  fanPhoto,
  fanPhotoUrl,
  fanPhotoError,
  fanPhotoBack,
  fanPhotoBackUrl,
  fanPhotoBackError,
  secondIdPhoto,
  secondIdPhotoUrl,
  secondIdPhotoError,
  showSecondId,
  onToggleSecondId,
  onUploadPhoto,
  onRemovePhoto,
  onUploadFanPhoto,
  onRemoveFanPhoto,
  onUploadFanPhotoBack,
  onRemoveFanPhotoBack,
  onUploadSecondIdPhoto,
  onRemoveSecondIdPhoto,
}: {
  form: UseFormReturn<RegisterFormValues>;
  photo: StoredPhoto | null;
  photoUrl: string | null;
  photoError: string | null;
  fanPhoto: StoredPhoto | null;
  fanPhotoUrl: string | null;
  fanPhotoError: string | null;
  fanPhotoBack: StoredPhoto | null;
  fanPhotoBackUrl: string | null;
  fanPhotoBackError: string | null;
  secondIdPhoto: StoredPhoto | null;
  secondIdPhotoUrl: string | null;
  secondIdPhotoError: string | null;
  showSecondId: boolean;
  onToggleSecondId: () => void;
  onUploadPhoto: (file: File | null) => void;
  onRemovePhoto: () => void;
  onUploadFanPhoto: (file: File | null) => void;
  onRemoveFanPhoto: () => void;
  onUploadFanPhotoBack: (file: File | null) => void;
  onRemoveFanPhotoBack: () => void;
  onUploadSecondIdPhoto: (file: File | null) => void;
  onRemoveSecondIdPhoto: () => void;
}) {
  const values = form.watch();
  const t = getRegisterTranslations(values.uiLanguage);
  const emailMatches = values.email.trim().length > 0 && values.email.trim() === values.confirmEmail.trim();
  const formatFan = (raw: string) => raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

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
      <h2 className="m-0 text-xl font-semibold">{t('step1')}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="firstName" label={t('form.firstName')} error={form.formState.errors.firstName?.message}>
          <input id="firstName" className={fieldClass} value={values.firstName} onChange={(e) => form.setValue('firstName', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" autoComplete="given-name" enterKeyHint="next" />
        </Field>
        <Field id="middleName" label={t('form.middleName')}>
          <input id="middleName" className={fieldClass} value={values.middleName} onChange={(e) => form.setValue('middleName', e.target.value, { shouldDirty: true })} autoCapitalize="words" autoComplete="additional-name" enterKeyHint="next" />
        </Field>
        <Field id="lastName" label={t('form.lastName')} error={form.formState.errors.lastName?.message}>
          <input id="lastName" className={fieldClass} value={values.lastName} onChange={(e) => form.setValue('lastName', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" autoComplete="family-name" enterKeyHint="next" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="amharicFirstName" label={t('form.amharicFirst')} error={form.formState.errors.amharicFirstName?.message}>
          <input id="amharicFirstName" className={fieldClass} value={values.amharicFirstName} onChange={(e) => setAmharicName('amharicFirstName', e.target.value)} />
        </Field>
        <Field id="amharicMiddleName" label={t('form.amharicMiddle')}>
          <input id="amharicMiddleName" className={fieldClass} value={values.amharicMiddleName} onChange={(e) => setAmharicName('amharicMiddleName', e.target.value)} />
        </Field>
        <Field id="amharicLastName" label={t('form.amharicLast')} error={form.formState.errors.amharicLastName?.message}>
          <input id="amharicLastName" className={fieldClass} value={values.amharicLastName} onChange={(e) => setAmharicName('amharicLastName', e.target.value)} />
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
            className={fieldClass}
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
            className={fieldClass}
          >
            <option value="">Select nationality</option>
            {nationalityOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field id="fanNumber" label={t('form.fan')} hint={t('form.fanHint')} error={form.formState.errors.fanNumber?.message}>
          <input id="fanNumber" value={formatFan(values.fanNumber)} onChange={(e) => form.setValue('fanNumber', formatFan(e.target.value), { shouldDirty: true, shouldValidate: true })} className={fieldClass} inputMode="numeric" enterKeyHint="next" />
        </Field>
      </div>

      <ImageField
        id="fanPhoto"
        label={t('form.fanPhoto')}
        hint={t('form.fanPhotoHint')}
        required
        variant="document"
        photo={fanPhoto}
        photoUrl={fanPhotoUrl}
        error={fanPhotoError ?? undefined}
        onUpload={onUploadFanPhoto}
        onRemove={onRemoveFanPhoto}
      />

      <ImageField
        id="fanPhotoBack"
        label={t('form.fanPhotoBack')}
        hint={t('form.fanPhotoBackHint')}
        variant="document"
        photo={fanPhotoBack}
        photoUrl={fanPhotoBackUrl}
        error={fanPhotoBackError ?? undefined}
        onUpload={onUploadFanPhotoBack}
        onRemove={onRemoveFanPhotoBack}
      />

      <Button type="button" variant="outline" className="h-11 w-fit" onClick={onToggleSecondId}>
        {showSecondId ? 'Hide second ID' : 'Add another ID'}
      </Button>
      {showSecondId ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="secondIdType" label={t('form.secondIdType')}>
              <select id="secondIdType" value={values.secondIdType} onChange={(e) => form.setValue('secondIdType', e.target.value as RegisterFormValues['secondIdType'], { shouldDirty: true })} className={fieldClass}>
                <option value="">Select</option>
                {secondIdTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field id="secondIdNumber" label={t('form.secondIdNumber')}>
              <input id="secondIdNumber" className={fieldClass} value={values.secondIdNumber} onChange={(e) => form.setValue('secondIdNumber', e.target.value, { shouldDirty: true })} />
            </Field>
          </div>
          <ImageField
            id="secondIdPhoto"
            label={t('form.secondIdPhoto')}
            hint="Upload a clear photo of this ID"
            variant="document"
            photo={secondIdPhoto}
            photoUrl={secondIdPhotoUrl}
            error={secondIdPhotoError ?? undefined}
            onUpload={onUploadSecondIdPhoto}
            onRemove={onRemoveSecondIdPhoto}
          />
        </div>
      ) : null}

      <ImageField
        id="photo"
        label={t('form.photo')}
        hint={t('form.photoHint')}
        required
        variant="document"
        capture="user"
        photo={photo}
        photoUrl={photoUrl}
        error={photoError ?? undefined}
        onUpload={onUploadPhoto}
        onRemove={onRemovePhoto}
      />

      <Field id="phone" label={t('form.phone')} error={form.formState.errors.phone?.message}>
        <PhoneInput id="phone" value={values.phone} onChange={(value) => form.setValue('phone', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.phone?.message} />
      </Field>

      <Field id="secondaryPhone" label={t('form.secondaryPhone')} hint={t('form.secondaryPhoneHint')} error={form.formState.errors.secondaryPhone?.message}>
        <PhoneInput id="secondaryPhone" value={values.secondaryPhone} onChange={(value) => form.setValue('secondaryPhone', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.secondaryPhone?.message} />
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
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium">
            <input type="checkbox" checked={values.whatsappNo} onChange={(e) => form.setValue('whatsappNo', e.target.checked, { shouldDirty: true, shouldValidate: true })} />
            {t('form.whatsappNone')}
          </label>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="email" label={t('form.email')} error={form.formState.errors.email?.message}>
          <input id="email" value={values.email} onChange={(e) => form.setValue('email', e.target.value, { shouldDirty: true, shouldValidate: true })} className={fieldClass} autoComplete="email" inputMode="email" enterKeyHint="next" />
        </Field>
        <Field id="confirmEmail" label={t('form.confirmEmail')} error={form.formState.errors.confirmEmail?.message}>
          <input id="confirmEmail" value={values.confirmEmail} onPaste={(e) => e.preventDefault()} onChange={(e) => form.setValue('confirmEmail', e.target.value, { shouldDirty: true, shouldValidate: true })} className={fieldClass} autoComplete="off" inputMode="email" enterKeyHint="next" />
        </Field>
      </div>
      {values.confirmEmail ? (
        <p className={`m-0 flex items-center gap-1.5 text-sm font-medium ${emailMatches ? 'text-[#067647]' : 'text-destructive'}`}>
          {emailMatches ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
          {emailMatches ? 'Emails match' : 'Emails do not match'}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="residenceRegion" label={t('form.residenceRegion')} error={form.formState.errors.residenceRegion?.message}>
          <select id="residenceRegion" className={fieldClass} value={values.residenceRegion} onChange={(e) => form.setValue('residenceRegion', e.target.value, { shouldDirty: true, shouldValidate: true })}>
            <option value="">Select</option>
            {regionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </Field>
        <Field id="residenceCity" label={t('form.residenceCity')} error={form.formState.errors.residenceCity?.message}>
          <input id="residenceCity" className={fieldClass} value={values.residenceCity} onChange={(e) => form.setValue('residenceCity', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" />
        </Field>
        <Field id="residenceDetail" label={t('form.residenceDetail')} error={form.formState.errors.residenceDetail?.message}>
          <input id="residenceDetail" className={fieldClass} value={values.residenceDetail} onChange={(e) => form.setValue('residenceDetail', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" />
        </Field>
      </div>
    </div>
  );
}
