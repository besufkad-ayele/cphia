"use client";

import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AppShell,
  Combobox,
  ConfirmDialog,
  ErrorSummary,
  Field,
  GlassCard,
  GoldButton,
  IdCard,
  LanguagePicker,
  PhoneInput,
  PhotoUpload,
  RadioCard,
  ReviewSection,
  SectorPicker,
  SegmentedControl,
  StepFooter,
  Stepper,
  SubmitOverlay,
  ToggleChip,
} from './components/ui';
import {
  educationOptions,
  ethiopianLanguages,
  healthSubsectorOptions,
  nationalityOptions,
  professionSuggestions,
  regionOptions,
  sectorOptions,
  secondIdTypeOptions,
  unOfficialLanguages,
} from './constants';
import { RegisterIntlProvider, appLocales, getRegisterTranslations, type AppLocale } from './i18n';
import { registerFormSchema, toSubmissionPayload } from './schema';
import { useDraft, SESSION_KEY, STORAGE_KEY, SUBMITTED_KEY } from './hooks/useDraft';
import { useStepValidation } from './hooks/useStepValidation';
import type { LanguageRow, RegisterFormValues } from './types';

function createLanguageRows(): LanguageRow[] {
  return unOfficialLanguages.map((language) => ({
    id: crypto.randomUUID(),
    group: 'un' as const,
    language,
    selected: false,
    proficiency: 'Basic' as const,
  }));
}

const formStepTitles = ['Personal details', 'Background & Languages', 'Sector', 'Review'];

const defaultValues: RegisterFormValues = {
  agree: false,
  firstName: '',
  middleName: '',
  lastName: '',
  amharicFirstName: '',
  amharicMiddleName: '',
  amharicLastName: '',
  fullNameAmharic: '',
  sex: '',
  age: '',
  nationality: '',
  fanNumber: '',
  secondIdType: '',
  secondIdNumber: '',
  phone: '+251',
  phoneIsWhatsApp: null,
  whatsappNumber: '',
  whatsappNo: false,
  email: '',
  confirmEmail: '',
  residenceRegion: '',
  residenceCity: '',
  residenceDetail: '',
  profession: '',
  educationLevel: '',
  emergencyName: '',
  emergencyPhone: '+251',
  emergencyRelationship: '',
  languages: createLanguageRows(),
  sector: '',
  healthSubsectors: [],
  uiLanguage: 'en',
};

function RegisterScreen() {
  const [locale, setLocale] = useState<AppLocale>('en');
  const [step, setStep] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showSecondId, setShowSecondId] = useState(false);

  const takePhotoRef = useRef<HTMLInputElement | null>(null);
  const choosePhotoRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<RegisterFormValues>({
    mode: 'onChange',
    resolver: zodResolver(registerFormSchema as z.ZodType<RegisterFormValues>),
    defaultValues,
  });

  const { hydrated, submittedId, setSubmittedId, photo, photoUrl, setDraftPhoto } = useDraft(form);
  const { triggerStep, errorSummary } = useStepValidation(form);
  const t = getRegisterTranslations(locale);

  const values = form.watch();
  const languages = values.languages;
  const emailMatches = values.email.trim().length > 0 && values.email.trim() === values.confirmEmail.trim();

  const setLocaleAndForm = (nextLocale: AppLocale) => {
    setLocale(nextLocale);
    form.setValue('uiLanguage', nextLocale);
  };

  const setAmharicName = (field: 'amharicFirstName' | 'amharicMiddleName' | 'amharicLastName', value: string) => {
    form.setValue(field, value, { shouldDirty: true, shouldValidate: true });
    const next = {
      ...form.getValues(),
      [field]: value,
    };
    form.setValue('fullNameAmharic', [next.amharicFirstName, next.amharicMiddleName, next.amharicLastName].filter(Boolean).join(' ').trim(), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const updateLanguage = (id: string, patch: Partial<LanguageRow>) => {
    form.setValue(
      'languages',
      languages.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const addOtherLanguage = () => {
    form.setValue('languages', [...languages, {
      id: crypto.randomUUID(),
      group: 'other',
      language: '',
      selected: true,
      proficiency: 'Basic',
    }], { shouldDirty: true, shouldValidate: true });
  };

  const removeLanguage = (id: string) => {
    form.setValue('languages', languages.filter((row) => row.id !== id), { shouldDirty: true, shouldValidate: true });
  };

  const formatFan = (raw: string) => raw.replace(/\D/g, '').slice(0, 20).replace(/(.{4})/g, '$1 ').trim();

  const uploadPhoto = async (file: File | null) => {
    if (!file) return;

    try {
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        initialQuality: 0.8,
        useWebWorker: true,
      });

      await setDraftPhoto({
        fileName: compressed.name,
        blob: compressed,
        size: compressed.size,
        type: compressed.type,
      });
    } catch {
      setServerError('Photo could not be processed. Please try another image.');
    }
  };

  const nextStep = async () => {
    if (step === -1) {
      const agree = form.getValues('agree');
      if (!agree) {
        form.setError('agree', { message: t('agreeRequired') });
        return;
      }
      setStep(0);
      return;
    }

    const valid = await triggerStep(step === 0 ? 1 : step === 1 ? 2 : step === 2 ? 3 : 3);
    if (!valid) return;

    if (step < 3) {
      setStep(step + 1);
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    setServerError(null);

    try {
      const idempotencyKey = localStorage.getItem(SESSION_KEY) ?? crypto.randomUUID();
      const submission = toSubmissionPayload(form.getValues(), idempotencyKey);
      const payload = new FormData();

      payload.append('agree', String(submission.agree));
      payload.append('firstName', submission.firstName);
      payload.append('middleName', submission.middleName);
      payload.append('lastName', submission.lastName);
      payload.append('fullNameAmharic', submission.fullNameAmharic);
      payload.append('sex', submission.sex);
      payload.append('age', String(submission.age));
      payload.append('nationality', submission.nationality);
      payload.append('fanNumber', submission.fanNumber.replace(/\s/g, ''));
      payload.append('secondIdType', submission.secondIdType);
      payload.append('secondIdNumber', submission.secondIdNumber);
      payload.append('phone', submission.phone);
      payload.append('phoneIsWhatsApp', String(submission.phoneIsWhatsApp));
      payload.append('whatsappNumber', submission.whatsappNumber);
      payload.append('whatsappNo', String(submission.whatsappNo));
      payload.append('email', submission.email);
      payload.append('confirmEmail', submission.confirmEmail);
      payload.append('residenceRegion', submission.residenceRegion);
      payload.append('residenceCity', submission.residenceCity);
      payload.append('residenceDetail', submission.residenceDetail);
      payload.append('profession', submission.profession);
      payload.append('educationLevel', submission.educationLevel);
      payload.append('emergencyName', submission.emergencyName);
      payload.append('emergencyPhone', submission.emergencyPhone);
      payload.append('emergencyRelationship', submission.emergencyRelationship);
      payload.append('sector', submission.sector);
      payload.append('healthSubsectors', JSON.stringify(submission.healthSubsectors));
      payload.append('languages', JSON.stringify(submission.languages));
      payload.append('uiLanguage', submission.uiLanguage);
      payload.append('idempotencyKey', submission.idempotencyKey);

      if (photo) {
        payload.append('photo', photo.blob, photo.fileName);
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        body: payload,
      });

      const result = await response.json();
      if (!response.ok) {
        const code = result?.error;
        if (code === 'DUPLICATE_DEVICE') throw new Error(t('duplicateDevice'));
        if (code === 'DUPLICATE_EMAIL') throw new Error(t('duplicateEmail'));
        if (code === 'DUPLICATE_PHONE') throw new Error(t('duplicatePhone'));
        if (code === 'DUPLICATE_FAN') throw new Error(t('duplicateFan'));
        if (!navigator.onLine) throw new Error(t('offline'));
        throw new Error(t('serverBusy'));
      }

      if (!result?.registrationId) {
        throw new Error('Registration completed without an ID. Please contact support.');
      }

      localStorage.setItem(SUBMITTED_KEY, JSON.stringify({ registrationId: result.registrationId, at: new Date().toISOString() }));
      localStorage.removeItem(STORAGE_KEY);
      setSubmittedId(result.registrationId as string);
      setShowConfirm(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t('serverBusy'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareId = async () => {
    if (!submittedId) return;
    if (navigator.share) {
      await navigator.share({ title: 'CPHIA Registration ID', text: submittedId });
    }
  };

  const saveIdAsImage = () => {
    if (!submittedId) return;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='100%' height='100%' fill='%230a3f3a'/><text x='60' y='200' fill='white' font-size='44' font-family='Arial'>CPHIA Registration ID</text><text x='60' y='330' fill='%23F5C518' font-size='86' font-weight='700' font-family='Arial'>${submittedId}</text></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${submittedId}.svg`;
    link.click();
  };

  const copyId = async () => {
    if (!submittedId) return;
    await navigator.clipboard.writeText(submittedId);
  };

  if (!hydrated) {
    return null;
  }

  if (submittedId) {
    return (
      <AppShell locale={locale} onLocaleChange={setLocaleAndForm}>
        <IdCard registrationId={submittedId} title={t('alreadyRegistered')} subtitle={t('emailSent')} />
        <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-3">
          <GoldButton type="button" onClick={copyId}>{t('copy')}</GoldButton>
          <button type="button" onClick={saveIdAsImage} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-white/35 px-4 font-bold text-white">{t('saveImage')}</button>
          <button type="button" onClick={() => void shareId()} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-white/35 px-4 font-bold text-white">{t('share')}</button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell locale={locale} onLocaleChange={setLocaleAndForm}>
      <RegisterIntlProvider locale={locale}>
        <div className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-[280px_1fr]">
          <Stepper step={Math.max(step, 0)} titles={formStepTitles} />

          <GlassCard className="p-4 sm:p-6">
            <ErrorSummary errors={errorSummary} />

            {step === -1 ? (
              <div className="grid gap-4">
                <h2 className="m-0 text-2xl font-black text-black">{t('consentTitle')}</h2>
                <p className="m-0 text-black/80">{t('consentNote')}</p>
                <div className="glass-dark rounded-2xl border border-white/30 p-4 text-sm font-semibold text-white">⚠ {t('consentWarning')}</div>
                <div className="grid gap-2">
                  <span className="text-sm font-bold text-black">{t('haveReady')}</span>
                  <ul className="m-0 list-disc pl-5 text-sm text-black/80">
                    <li>FAN number (optional)</li>
                    <li>Phone number</li>
                    <li>Email address</li>
                    <li>Optional photo</li>
                  </ul>
                </div>

                <label className="flex min-h-12 items-start gap-3 rounded-2xl border border-black/20 bg-white p-3 text-black">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={values.agree}
                    onChange={(event) => form.setValue('agree', event.target.checked, { shouldValidate: true, shouldDirty: true })}
                  />
                  <span className="text-sm font-semibold">{t('agree')}</span>
                </label>

                <GoldButton type="button" onClick={() => void nextStep()} disabled={!values.agree}>{t('agreeCta')}</GoldButton>
              </div>
            ) : null}

            {step === 0 ? (
              <div className="grid gap-4">
                <h2 className="m-0 text-xl font-black text-black">{t('step1')}</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field id="firstName" label={t('form.firstName')} error={form.formState.errors.firstName?.message}><input id="firstName" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.firstName} onChange={(e) => form.setValue('firstName', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" autoComplete="given-name" enterKeyHint="next" /></Field>
                  <Field id="middleName" label={t('form.middleName')}><input id="middleName" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.middleName} onChange={(e) => form.setValue('middleName', e.target.value, { shouldDirty: true })} autoCapitalize="words" autoComplete="additional-name" enterKeyHint="next" /></Field>
                  <Field id="lastName" label={t('form.lastName')} error={form.formState.errors.lastName?.message}><input id="lastName" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.lastName} onChange={(e) => form.setValue('lastName', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" autoComplete="family-name" enterKeyHint="next" /></Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field id="amharicFirstName" label={t('form.amharicFirst')} error={form.formState.errors.amharicFirstName?.message}><input id="amharicFirstName" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.amharicFirstName} onChange={(e) => setAmharicName('amharicFirstName', e.target.value)} /></Field>
                  <Field id="amharicMiddleName" label={t('form.amharicMiddle')}><input id="amharicMiddleName" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.amharicMiddleName} onChange={(e) => setAmharicName('amharicMiddleName', e.target.value)} /></Field>
                  <Field id="amharicLastName" label={t('form.amharicLast')} error={form.formState.errors.amharicLastName?.message}><input id="amharicLastName" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.amharicLastName} onChange={(e) => setAmharicName('amharicLastName', e.target.value)} /></Field>
                </div>

                <Field id="sex" label={t('form.sex')} error={form.formState.errors.sex?.message}>
                  <SegmentedControl name="sex" value={values.sex} options={['Male', 'Female']} onChange={(value) => form.setValue('sex', value as RegisterFormValues['sex'], { shouldValidate: true, shouldDirty: true })} />
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field id="age" label={t('form.age')} error={form.formState.errors.age?.message}><input id="age" value={values.age} onChange={(e) => form.setValue('age', e.target.value.replace(/\D/g, '').slice(0, 2), { shouldDirty: true, shouldValidate: true })} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" inputMode="numeric" min={18} max={70} enterKeyHint="next" /></Field>
                  <Field id="nationality" label={t('form.nationality')} error={form.formState.errors.nationality?.message}>
                    <select
                      id="nationality"
                      value={values.nationality}
                      onChange={(event) => form.setValue('nationality', event.target.value, { shouldDirty: true, shouldValidate: true })}
                      className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 bg-white px-3 text-black"
                    >
                      <option value="">Select nationality</option>
                      {nationalityOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field id="fanNumber" label={t('form.fan')} hint={t('form.fanHint')} error={form.formState.errors.fanNumber?.message}><input id="fanNumber" value={formatFan(values.fanNumber)} onChange={(e) => form.setValue('fanNumber', formatFan(e.target.value), { shouldDirty: true, shouldValidate: true })} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" inputMode="numeric" enterKeyHint="next" /></Field>
                </div>

                <button type="button" className="focus-ring w-fit min-h-12 rounded-full border border-black/20 px-4 text-sm font-bold text-black" onClick={() => setShowSecondId((prev) => !prev)}>Add another ID</button>
                {showSecondId ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="secondIdType" label={t('form.secondIdType')}>
                      <select id="secondIdType" value={values.secondIdType} onChange={(e) => form.setValue('secondIdType', e.target.value as RegisterFormValues['secondIdType'], { shouldDirty: true })} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3">
                        <option value="">Select</option>
                        {secondIdTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </Field>
                    <Field id="secondIdNumber" label={t('form.secondIdNumber')}><input id="secondIdNumber" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.secondIdNumber} onChange={(e) => form.setValue('secondIdNumber', e.target.value, { shouldDirty: true })} /></Field>
                  </div>
                ) : null}

                <Field id="photo" label={t('form.photo')}>
                  <PhotoUpload
                    photoUrl={photoUrl}
                    photoName={photo?.fileName}
                    sizeLabel={photo ? `${Math.round(photo.size / 1024)} KB` : undefined}
                    onTake={() => takePhotoRef.current?.click()}
                    onChoose={() => choosePhotoRef.current?.click()}
                    onRemove={() => void setDraftPhoto(null)}
                  />
                  <input ref={takePhotoRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => void uploadPhoto(e.target.files?.[0] ?? null)} />
                  <input ref={choosePhotoRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadPhoto(e.target.files?.[0] ?? null)} />
                </Field>

                <Field id="phone" label={t('form.phone')} error={form.formState.errors.phone?.message}><PhoneInput id="phone" value={values.phone} onChange={(value) => form.setValue('phone', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.phone?.message} /></Field>

                <Field id="phoneIsWhatsApp" label={t('form.whatsappSame')} error={form.formState.errors.phoneIsWhatsApp?.message}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <RadioCard checked={values.phoneIsWhatsApp === true} label={t('form.yes')} onClick={() => form.setValue('phoneIsWhatsApp', true, { shouldDirty: true, shouldValidate: true })} />
                    <RadioCard checked={values.phoneIsWhatsApp === false} label={t('form.no')} onClick={() => form.setValue('phoneIsWhatsApp', false, { shouldDirty: true, shouldValidate: true })} />
                  </div>
                </Field>

                {values.phoneIsWhatsApp === false ? (
                  <div className="grid gap-3">
                    <Field id="whatsappNumber" label={t('form.whatsapp')} error={form.formState.errors.whatsappNumber?.message}><PhoneInput id="whatsappNumber" value={values.whatsappNumber} onChange={(value) => form.setValue('whatsappNumber', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.whatsappNumber?.message} /></Field>
                    <label className="flex min-h-12 items-center gap-2 rounded-[var(--radius-field)] border border-black/20 px-3 text-sm font-semibold text-black">
                      <input type="checkbox" checked={values.whatsappNo} onChange={(e) => form.setValue('whatsappNo', e.target.checked, { shouldDirty: true, shouldValidate: true })} />
                      {t('form.whatsappNone')}
                    </label>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="email" label={t('form.email')} error={form.formState.errors.email?.message}><input id="email" value={values.email} onChange={(e) => form.setValue('email', e.target.value, { shouldDirty: true, shouldValidate: true })} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" autoComplete="email" inputMode="email" enterKeyHint="next" /></Field>
                  <Field id="confirmEmail" label={t('form.confirmEmail')} error={form.formState.errors.confirmEmail?.message}><input id="confirmEmail" value={values.confirmEmail} onPaste={(e) => e.preventDefault()} onChange={(e) => form.setValue('confirmEmail', e.target.value, { shouldDirty: true, shouldValidate: true })} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" autoComplete="off" inputMode="email" enterKeyHint="next" /></Field>
                </div>
                {values.confirmEmail ? <p className={`m-0 text-sm font-semibold ${emailMatches ? 'text-[#067647]' : 'text-[#B42318]'}`}>{emailMatches ? '✓ Emails match' : '⚠ Emails do not match'}</p> : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field id="residenceRegion" label={t('form.residenceRegion')} error={form.formState.errors.residenceRegion?.message}>
                    <select id="residenceRegion" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.residenceRegion} onChange={(e) => form.setValue('residenceRegion', e.target.value, { shouldDirty: true, shouldValidate: true })}>
                      <option value="">Select</option>
                      {regionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field id="residenceCity" label={t('form.residenceCity')} error={form.formState.errors.residenceCity?.message}><input id="residenceCity" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.residenceCity} onChange={(e) => form.setValue('residenceCity', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" /></Field>
                  <Field id="residenceDetail" label={t('form.residenceDetail')} error={form.formState.errors.residenceDetail?.message}><input id="residenceDetail" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.residenceDetail} onChange={(e) => form.setValue('residenceDetail', e.target.value, { shouldDirty: true, shouldValidate: true })} autoCapitalize="words" /></Field>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4">
                <h2 className="m-0 text-xl font-black text-black">{t('step2')}</h2>
                <Field id="profession" label={t('form.profession')} error={form.formState.errors.profession?.message}><Combobox id="profession" value={values.profession} options={professionSuggestions} onChange={(value) => form.setValue('profession', value, { shouldDirty: true, shouldValidate: true })} /></Field>
                <Field id="educationLevel" label={t('form.education')} error={form.formState.errors.educationLevel?.message}>
                  <select id="educationLevel" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.educationLevel} onChange={(e) => form.setValue('educationLevel', e.target.value as RegisterFormValues['educationLevel'], { shouldDirty: true, shouldValidate: true })}>
                    <option value="">Select</option>
                    {educationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field id="emergencyName" label={t('form.emergencyName')} error={form.formState.errors.emergencyName?.message}><input id="emergencyName" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.emergencyName} onChange={(e) => form.setValue('emergencyName', e.target.value, { shouldDirty: true, shouldValidate: true })} /></Field>
                  <Field id="emergencyPhone" label={t('form.emergencyPhone')} error={form.formState.errors.emergencyPhone?.message}><PhoneInput id="emergencyPhone" value={values.emergencyPhone} onChange={(value) => form.setValue('emergencyPhone', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.emergencyPhone?.message} /></Field>
                  <Field id="emergencyRelationship" label={t('form.emergencyRelationship')} error={form.formState.errors.emergencyRelationship?.message}><input id="emergencyRelationship" className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 px-3" value={values.emergencyRelationship} onChange={(e) => form.setValue('emergencyRelationship', e.target.value, { shouldDirty: true, shouldValidate: true })} /></Field>
                </div>

                <Field id="languages" label={t('form.language')} error={form.formState.errors.languages?.message as string | undefined}>
                  <LanguagePicker
                    rows={languages}
                    onToggle={(id) => {
                      const row = languages.find((item) => item.id === id);
                      if (!row) return;
                      updateLanguage(id, { selected: !row.selected });
                    }}
                    onProficiency={(id, proficiency) => updateLanguage(id, { proficiency })}
                    onRename={(id, language) => updateLanguage(id, { language })}
                    onAddOther={addOtherLanguage}
                    onRemove={removeLanguage}
                  />
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4">
                <h2 className="m-0 text-xl font-black text-black">{t('step3')}</h2>
                <Field id="sector" label={t('form.sector')} error={form.formState.errors.sector?.message}>
                  <SectorPicker options={sectorOptions} value={values.sector} onChange={(value) => {
                    form.setValue('sector', value as RegisterFormValues['sector'], { shouldDirty: true, shouldValidate: true });
                    if (value !== 'Health') {
                      form.setValue('healthSubsectors', [], { shouldDirty: true, shouldValidate: true });
                    }
                  }} />
                </Field>

                {values.sector === 'Health' ? (
                  <Field id="healthSubsectors" label={t('form.healthSubsector')} error={form.formState.errors.healthSubsectors?.message as string | undefined}>
                    <div className="flex flex-wrap gap-2">
                      {healthSubsectorOptions.map((item) => {
                        const selected = values.healthSubsectors.includes(item);
                        return (
                          <ToggleChip
                            key={item}
                            selected={selected}
                            label={item}
                            onClick={() => {
                              const next = selected
                                ? values.healthSubsectors.filter((subsector) => subsector !== item)
                                : [...values.healthSubsectors, item];
                              form.setValue('healthSubsectors', next, { shouldDirty: true, shouldValidate: true });
                            }}
                          />
                        );
                      })}
                    </div>
                  </Field>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4">
                <h2 className="m-0 text-xl font-black text-black">{t('step4')}</h2>

                <ReviewSection title="Personal" onEdit={() => setStep(0)}>
                  <p><strong>Name:</strong> {values.firstName} {values.middleName} {values.lastName}</p>
                  <p><strong>Amharic:</strong> {values.fullNameAmharic}</p>
                  <p><strong>Sex:</strong> {values.sex || '-'}</p>
                  <p><strong>Age:</strong> {values.age}</p>
                  <p><strong>Nationality:</strong> {values.nationality}</p>
                  <p><strong>FAN:</strong> {values.fanNumber || 'Not provided'}</p>
                </ReviewSection>

                <ReviewSection title="Contact" onEdit={() => setStep(0)}>
                  <p><strong>Phone:</strong> {values.phone}</p>
                  <p><strong>WhatsApp:</strong> {values.phoneIsWhatsApp ? values.phone : values.whatsappNo ? 'No WhatsApp' : values.whatsappNumber || 'Not provided'}</p>
                  <p><strong>Email:</strong> {values.email}</p>
                  <p><strong>Residence:</strong> {values.residenceRegion} / {values.residenceCity} / {values.residenceDetail}</p>
                </ReviewSection>

                <ReviewSection title="Background" onEdit={() => setStep(1)}>
                  <p><strong>Profession:</strong> {values.profession}</p>
                  <p><strong>Education:</strong> {values.educationLevel}</p>
                  <p><strong>Emergency:</strong> {values.emergencyName} ({values.emergencyRelationship}) — {values.emergencyPhone}</p>
                </ReviewSection>

                <ReviewSection title="Languages" onEdit={() => setStep(1)}>
                  <p>{values.languages.filter((item) => item.selected && item.language.trim()).map((item) => `${item.language} (${item.proficiency})`).join(', ') || '-'}</p>
                </ReviewSection>

                <ReviewSection title="Sector" onEdit={() => setStep(2)}>
                  <p><strong>Sector:</strong> {values.sector}</p>
                  <p><strong>Health sub-sectors:</strong> {values.sector === 'Health' ? values.healthSubsectors.join(', ') || '-' : 'Not applicable'}</p>
                </ReviewSection>

                {photoUrl ? (
                  <ReviewSection title="Photo" onEdit={() => setStep(0)}>
                    <img src={photoUrl} alt="Uploaded photo" className="h-20 w-20 rounded-full border border-black/20 object-cover" />
                  </ReviewSection>
                ) : null}

                {serverError ? <div className="rounded-[var(--radius-field)] border border-[#B42318]/40 bg-[#fff1f1] p-3 text-sm font-semibold text-[#8b1c13]">{serverError}</div> : null}

                <GoldButton type="button" onClick={() => setShowConfirm(true)} disabled={isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? t('submitting') : t('submit')}
                </GoldButton>
              </div>
            ) : null}
          </GlassCard>
        </div>

        <StepFooter
          canBack={step > -1}
          backLabel={t('back')}
          onBack={() => setStep((prev) => Math.max(-1, prev - 1))}
          nextLabel={step >= 3 ? t('submit') : step === 2 ? t('review') : t('continue')}
          onNext={() => {
            if (step >= 3) {
              setShowConfirm(true);
              return;
            }
            void nextStep();
          }}
          disabled={isSubmitting || (step === -1 && !values.agree)}
        />

        <ConfirmDialog
          open={showConfirm}
          title={t('confirmSubmit')}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => void submit()}
        />

        <SubmitOverlay open={isSubmitting} />
      </RegisterIntlProvider>
    </AppShell>
  );
}

export default function RegisterPage() {
  return (
    <RegisterIntlProvider locale="en">
      <RegisterScreen />
    </RegisterIntlProvider>
  );
}
