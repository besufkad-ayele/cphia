"use client";

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AppShell,
  ConfirmDialog,
  ErrorSummary,
  GlassCard,
  GoldButton,
  IdCard,
  StepFooter,
  Stepper,
  SubmitOverlay,
} from './components/ui';
import { ethiopianLanguages, unOfficialLanguages } from './constants';
import { RegisterIntlProvider, getRegisterTranslations, type AppLocale } from './i18n';
import { downloadIdAsImage } from './lib/canvasDownload';
import { buildRegistrationFormData } from './lib/formData';
import { registerFormSchema, toSubmissionPayload } from './schema';
import { BackgroundStep, ConsentStep, PersonalStep, ReviewStep, SectorStep } from './steps';
import { useDraft, SESSION_KEY, STORAGE_KEY, SUBMITTED_KEY } from './hooks/useDraft';
import { useStepValidation } from './hooks/useStepValidation';
import type { LanguageRow, RegisterFormValues } from './types';

function createLanguageRows(): LanguageRow[] {
  return [
    ...ethiopianLanguages.map((language) => ({
      id: crypto.randomUUID(),
      group: 'ethiopian' as const,
      language,
      selected: false,
      proficiency: 'Basic' as const,
    })),
    ...unOfficialLanguages.map((language) => ({
      id: crypto.randomUUID(),
      group: 'un' as const,
      language,
      selected: false,
      proficiency: 'Basic' as const,
    })),
  ];
}

const STEPS = [ConsentStep, PersonalStep, BackgroundStep, SectorStep, ReviewStep] as const;
const formStepTitles = ['Consent', 'Personal details', 'Background & Languages', 'Sector', 'Review'];

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

async function hashValue(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((item) => item.toString(16).padStart(2, '0')).join('');
}

function RegisterScreen() {
  const [locale, setLocale] = useState<AppLocale>('en');
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
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
  const StepComponent = STEPS[Math.max(step, 0)];

  const setLocaleAndForm = (nextLocale: AppLocale) => {
    setLocale(nextLocale);
    form.setValue('uiLanguage', nextLocale);
  };

  const uploadPhoto = async (file: File | null) => {
    setPhotoError(null);
    if (!file) return;

    if (file.size > 10_000_000) {
      if (takePhotoRef.current) takePhotoRef.current.value = '';
      if (choosePhotoRef.current) choosePhotoRef.current.value = '';
      setPhotoError('Photo must be under 10 MB. Please choose a smaller image.');
      return;
    }

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
      setPhotoError('Photo could not be processed. Please try another image.');
    }
  };

  const nextStep = async () => {
    const valid = await triggerStep(step);
    if (!valid) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const submit = async () => {
    setIsSubmitting(true);
    setServerError(null);

    try {
      const idempotencyKey = localStorage.getItem(SESSION_KEY) ?? crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, idempotencyKey);
      const submission = toSubmissionPayload(form.getValues(), idempotencyKey);
      const deviceTokenHash = await hashValue(idempotencyKey);
      const payload = buildRegistrationFormData(submission, photo, { deviceTokenHash });

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
          <button type="button" onClick={() => downloadIdAsImage(submittedId, setServerError)} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-white/35 px-4 font-bold text-white">{t('saveImage')}</button>
          <button type="button" onClick={() => void shareId()} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-white/35 px-4 font-bold text-white">{t('share')}</button>
        </div>
        {serverError ? <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[#ffdcdc]">{serverError}</p> : null}
      </AppShell>
    );
  }

  return (
    <AppShell locale={locale} onLocaleChange={setLocaleAndForm}>
      <RegisterIntlProvider locale={locale}>
        <div className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-[280px_1fr]">
          <Stepper step={step} titles={formStepTitles} />

          <GlassCard className="p-4 sm:p-6">
            <ErrorSummary errors={errorSummary} />

            {StepComponent === ConsentStep ? (
              <ConsentStep form={form} onContinue={() => void nextStep()} />
            ) : null}

            {StepComponent === PersonalStep ? (
              <PersonalStep
                form={form}
                photo={photo}
                photoUrl={photoUrl}
                photoError={photoError}
                showSecondId={showSecondId}
                onToggleSecondId={() => setShowSecondId((prev) => !prev)}
                onTakePhoto={() => takePhotoRef.current?.click()}
                onChoosePhoto={() => choosePhotoRef.current?.click()}
                onRemovePhoto={() => void setDraftPhoto(null)}
                takePhotoRef={takePhotoRef}
                choosePhotoRef={choosePhotoRef}
                onUploadPhoto={(file) => void uploadPhoto(file)}
              />
            ) : null}

            {StepComponent === BackgroundStep ? <BackgroundStep form={form} /> : null}
            {StepComponent === SectorStep ? <SectorStep form={form} /> : null}

            {StepComponent === ReviewStep ? (
              <ReviewStep
                form={form}
                photoUrl={photoUrl}
                serverError={serverError}
                isSubmitting={isSubmitting}
                onEdit={setStep}
                onSubmit={() => setShowConfirm(true)}
              />
            ) : null}
          </GlassCard>
        </div>

        <StepFooter
          canBack={step > 0}
          backLabel={t('back')}
          onBack={() => setStep((prev) => Math.max(0, prev - 1))}
          nextLabel={step >= 4 ? t('submit') : step === 3 ? t('review') : step === 0 ? t('agreeCta') : t('continue')}
          onNext={() => {
            if (step >= 4) {
              setShowConfirm(true);
              return;
            }
            void nextStep();
          }}
          disabled={isSubmitting || (step === 0 && !values.agree)}
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
