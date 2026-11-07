"use client";

import { useEffect, useLayoutEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Skeleton } from '@/components/ui/skeleton';
import { VolunteerIdCard } from '@/components/register/volunteer-id-card';
import {
  AppShell,
  ConfirmDialog,
  ErrorSummary,
  GlassCard,
  StepFooter,
  Stepper,
  SubmitOverlay,
} from './components/ui';
import { ethiopianLanguages, unOfficialLanguages } from './constants';
import { RegisterIntlProvider, getRegisterTranslations, type AppLocale } from './i18n';
import { downloadIdAsImage } from './lib/canvasDownload';
import { buildRegistrationFormData } from './lib/formData';
import { readStoredBadge, storeBadge } from './lib/badge';
import { registerFormSchema, toSubmissionPayload } from './schema';
import { BackgroundStep, ConsentStep, PersonalStep, ReviewStep, SectorStep } from './steps';
import { badgeFromForm } from './steps/ReviewStep';
import { useDraft, SESSION_KEY, STORAGE_KEY, SUBMITTED_KEY } from './hooks/useDraft';
import { useStepValidation } from './hooks/useStepValidation';
import type { LanguageRow, RegisterFormValues, StoredPhoto } from './types';

function createLanguageRows(): LanguageRow[] {
  return [
    ...unOfficialLanguages.map((language) => ({
      id: crypto.randomUUID(),
      group: 'un' as const,
      language,
      selected: false,
      proficiency: 'Basic' as const,
    })),
    ...ethiopianLanguages.map((language) => ({
      id: crypto.randomUUID(),
      group: 'ethiopian' as const,
      language,
      selected: language === 'Amharic',
      proficiency: (language === 'Amharic' ? 'Native' : 'Basic') as LanguageRow['proficiency'],
    })),
  ];
}

const STEPS = [ConsentStep, PersonalStep, BackgroundStep, SectorStep, ReviewStep] as const;

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
  nationality: 'Ethiopian',
  fanNumber: '',
  secondIdType: '',
  secondIdNumber: '',
  phone: '+251',
  secondaryPhone: '',
  phoneIsWhatsApp: null,
  whatsappNumber: '',
  whatsappNo: false,
  email: '',
  confirmEmail: '',
  residenceRegion: 'Addis Ababa',
  residenceCity: 'Addis Ababa',
  residenceDetail: '',
  profession: '',
  educationLevel: '',
  emergencyName: '',
  emergencyPhone: '+251',
  emergencyRelationship: '',
  languages: createLanguageRows(),
  sector: '',
  healthSubsectors: [],
  bankName: 'Commercial Bank of Ethiopia',
  bankAccountName: '',
  bankAccountNumber: '',
  bankAccountOtherOwner: false,
  ureportRegistered: null,
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
  const [fanPhotoError, setFanPhotoError] = useState<string | null>(null);
  const [fanPhotoBackError, setFanPhotoBackError] = useState<string | null>(null);
  const [secondIdPhotoError, setSecondIdPhotoError] = useState<string | null>(null);
  const [ureportError, setUreportError] = useState<string | null>(null);
  const [bankOwnerPhotoError, setBankOwnerPhotoError] = useState<string | null>(null);
  const [showSecondId, setShowSecondId] = useState(false);

  const form = useForm<RegisterFormValues>({
    mode: 'onChange',
    resolver: zodResolver(registerFormSchema as z.ZodType<RegisterFormValues>),
    defaultValues,
  });

  const {
    hydrated,
    submittedId,
    setSubmittedId,
    submittedEmailSent,
    setSubmittedEmailSent,
    photo,
    photoUrl,
    setDraftPhoto,
    ureportPhoto,
    ureportUrl,
    setUreportPhoto,
    fanPhoto,
    fanPhotoUrl,
    setFanPhoto,
    fanPhotoBack,
    fanPhotoBackUrl,
    setFanPhotoBack,
    secondIdPhoto,
    secondIdPhotoUrl,
    setSecondIdPhoto,
    bankOwnerPhoto,
    bankOwnerPhotoUrl,
    setBankOwnerPhoto,
  } = useDraft(form);
  const { triggerStep, errorSummary } = useStepValidation(form);
  const t = getRegisterTranslations(locale);
  const formStepTitles = [t('consentTitle'), t('step1'), t('step2'), t('step3'), t('step4')];
  const values = form.watch();
  const StepComponent = STEPS[Math.max(step, 0)];

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [step]);

  const setLocaleAndForm = (nextLocale: AppLocale) => {
    setLocale(nextLocale);
    form.setValue('uiLanguage', nextLocale);
  };

  useEffect(() => {
    if (!hydrated) return;
    const current = form.getValues('languages');
    const missing = unOfficialLanguages.filter(
      (language) => !current.some((row) => row.group === 'un' && row.language === language),
    );
    if (!missing.length) return;
    form.setValue('languages', [
      ...current,
      ...missing.map((language) => ({
        id: crypto.randomUUID(),
        group: 'un' as const,
        language,
        selected: false,
        proficiency: 'Basic' as const,
      })),
    ]);
  }, [form, hydrated]);

  const saveImage = async (
    file: File | null,
    setter: (photo: StoredPhoto) => Promise<void>,
    setError: (message: string | null) => void,
    label: string,
    options?: { imagesOnly?: boolean },
  ) => {
    setError(null);
    if (!file) return;
    try {
      const { prepareUploadFile } = await import('@/app/lib/prepare-upload');
      const prepared = await prepareUploadFile(file, { imagesOnly: options?.imagesOnly, compress: true });
      if ('error' in prepared) {
        setError(`${label}: ${prepared.message}`);
        return;
      }
      await setter({
        fileName: prepared.file.name,
        blob: prepared.file,
        size: prepared.file.size,
        type: prepared.mime,
      });
    } catch {
      setError(`${label} could not be processed. Please try another file.`);
    }
  };

  const nextStep = async () => {
    const valid = await triggerStep(step);
    if (!valid) return;
    if (step === 1 && !photo) {
      setPhotoError('A professional personal photo is required for the event ID.');
      return;
    }
    if (step === 1 && !fanPhoto) {
      setFanPhotoError('A photo of your national ID is required.');
      return;
    }
    if (step === 1 && (form.getValues('secondIdType') || form.getValues('secondIdNumber')) && !secondIdPhoto) {
      setSecondIdPhotoError('Upload a photo of this ID.');
      return;
    }
    if (step === 3 && form.getValues('ureportRegistered') && !ureportPhoto) {
      setUreportError('Upload your U-Report registration screenshot.');
      return;
    }
    if (step === 3 && form.getValues('bankAccountOtherOwner') && !bankOwnerPhoto) {
      setBankOwnerPhotoError('Upload a photo of the account owner’s ID.');
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const submit = async () => {
    if (isSubmitting) return;
    setServerError(null);

    if (!photo) {
      setShowConfirm(false);
      setPhotoError('A professional personal photo is required for the event ID.');
      setStep(1);
      return;
    }
    if (!fanPhoto) {
      setShowConfirm(false);
      setFanPhotoError('A photo of your national ID is required.');
      setStep(1);
      return;
    }
    if (form.getValues('bankAccountOtherOwner') && !bankOwnerPhoto) {
      setShowConfirm(false);
      setBankOwnerPhotoError('Upload a photo of the account owner’s ID.');
      setStep(3);
      return;
    }
    if (form.getValues('ureportRegistered') && !ureportPhoto) {
      setShowConfirm(false);
      setUreportError('Upload your U-Report registration screenshot.');
      setStep(3);
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey = localStorage.getItem(SESSION_KEY) ?? crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, idempotencyKey);
      const submission = toSubmissionPayload(form.getValues(), idempotencyKey);
      const deviceTokenHash = await hashValue(idempotencyKey);
      const payload = buildRegistrationFormData(submission, photo, {
        deviceTokenHash,
        ureportScreenshot: ureportPhoto,
        fanPhoto,
        fanPhotoBack,
        secondIdPhoto,
        bankOwnerIdPhoto: bankOwnerPhoto,
      });

      let response: Response;
      try {
        response = await fetch('/api/register', {
          method: 'POST',
          body: payload,
        });
      } catch {
        const { resolveClientRegisterError } = await import('@/app/lib/registration-errors');
        throw new Error(resolveClientRegisterError({
          status: 0,
          online: navigator.onLine,
          body: null,
          networkFailure: true,
        }));
      }

      let result: { error?: string; message?: string; details?: unknown; registrationId?: string; emailSent?: boolean } | null = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        const { resolveClientRegisterError } = await import('@/app/lib/registration-errors');
        const code = result?.error;
        if (code === 'DUPLICATE_DEVICE') throw new Error(t('duplicateDevice'));
        if (code === 'DUPLICATE_EMAIL') throw new Error(t('duplicateEmail'));
        if (code === 'DUPLICATE_PHONE') throw new Error(t('duplicatePhone'));
        if (code === 'DUPLICATE_FAN') throw new Error(t('duplicateFan'));
        if (code === 'INVALID_FAN') throw new Error(t('form.fanHint'));
        throw new Error(resolveClientRegisterError({
          status: response.status,
          online: navigator.onLine,
          body: result,
        }));
      }

      if (!result?.registrationId) {
        throw new Error('Registration completed without an ID. Please contact support with the time you submitted.');
      }

      storeBadge(badgeFromForm(form.getValues(), result.registrationId as string));
      const emailSent = Boolean(result.emailSent);
      localStorage.setItem(SUBMITTED_KEY, JSON.stringify({ registrationId: result.registrationId, emailSent, at: new Date().toISOString() }));
      localStorage.removeItem(STORAGE_KEY);
      setSubmittedEmailSent(emailSent);
      setSubmittedId(result.registrationId as string);
      setShowConfirm(false);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch (error) {
      setShowConfirm(false);
      setServerError(
        error instanceof Error && error.message
          ? error.message
          : (navigator.onLine
            ? 'Registration could not be completed. Please try again.'
            : t('offline')),
      );
      setStep(4);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
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
    return (
      <main className="grid min-h-screen gap-3 bg-primary p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (submittedId) {
    const badge = readStoredBadge() ?? {
      registrationId: submittedId,
      name: 'Volunteer',
      amharicName: '',
      sex: '',
      age: '',
      nationality: '',
      fanNumber: '',
      phone: '',
      sector: '',
      profession: '',
      residence: '',
      languages: '',
    };
    return (
      <AppShell locale={locale} onLocaleChange={setLocaleAndForm}>
        <div className="mx-auto mt-6 max-w-3xl">
          <VolunteerIdCard
            badge={{ ...badge, registrationId: submittedId }}
            photoUrl={photoUrl}
            title={t('alreadyRegistered')}
            onCopy={copyId}
            onDownload={() => void downloadIdAsImage({ ...badge, registrationId: submittedId }, photoUrl, setServerError)}
            onShare={() => void shareId()}
          />
          <p className="mt-3 text-center text-sm text-muted-foreground">{submittedEmailSent ? t('emailSent') : t('emailNotSent')}</p>
        </div>
        {serverError ? <p className="mx-auto mt-3 max-w-xl text-center text-sm text-destructive">{serverError}</p> : null}
      </AppShell>
    );
  }

  return (
    <AppShell locale={locale} onLocaleChange={setLocaleAndForm} progress={{ step, titles: formStepTitles }}>
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
                fanPhoto={fanPhoto}
                fanPhotoUrl={fanPhotoUrl}
                fanPhotoError={fanPhotoError}
                fanPhotoBack={fanPhotoBack}
                fanPhotoBackUrl={fanPhotoBackUrl}
                fanPhotoBackError={fanPhotoBackError}
                secondIdPhoto={secondIdPhoto}
                secondIdPhotoUrl={secondIdPhotoUrl}
                secondIdPhotoError={secondIdPhotoError}
                showSecondId={showSecondId || Boolean(values.secondIdType || values.secondIdNumber)}
                onToggleSecondId={() => setShowSecondId((prev) => !prev)}
                onUploadPhoto={(file) => void saveImage(file, setDraftPhoto, setPhotoError, 'Personal photo', { imagesOnly: true })}
                onRemovePhoto={() => void setDraftPhoto(null)}
                onUploadFanPhoto={(file) => void saveImage(file, setFanPhoto, setFanPhotoError, 'National ID front')}
                onRemoveFanPhoto={() => void setFanPhoto(null)}
                onUploadFanPhotoBack={(file) => void saveImage(file, setFanPhotoBack, setFanPhotoBackError, 'National ID back')}
                onRemoveFanPhotoBack={() => {
                  setFanPhotoBackError(null);
                  void setFanPhotoBack(null);
                }}
                onUploadSecondIdPhoto={(file) => void saveImage(file, setSecondIdPhoto, setSecondIdPhotoError, 'ID file')}
                onRemoveSecondIdPhoto={() => void setSecondIdPhoto(null)}
              />
            ) : null}

            {StepComponent === BackgroundStep ? <BackgroundStep form={form} /> : null}
            {StepComponent === SectorStep ? (
              <SectorStep
                form={form}
                ureportUrl={ureportUrl}
                ureportPhoto={ureportPhoto}
                ureportError={ureportError}
                onUploadUreport={(file) => void saveImage(file, setUreportPhoto, setUreportError, 'U-Report file')}
                onRemoveUreport={() => void setUreportPhoto(null)}
                bankOwnerPhoto={bankOwnerPhoto}
                bankOwnerPhotoUrl={bankOwnerPhotoUrl}
                bankOwnerPhotoError={bankOwnerPhotoError}
                onUploadBankOwnerPhoto={(file) => void saveImage(file, setBankOwnerPhoto, setBankOwnerPhotoError, 'Account owner ID')}
                onRemoveBankOwnerPhoto={() => {
                  setBankOwnerPhotoError(null);
                  void setBankOwnerPhoto(null);
                }}
              />
            ) : null}

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
          title={t('confirmSubmitTitle')}
          description={t('confirmSubmit')}
          checklist={t('confirmSubmitChecklist')}
          confirmLabel={t('confirmFinal')}
          cancelLabel={t('cancel')}
          busy={isSubmitting}
          onCancel={() => {
            if (!isSubmitting) setShowConfirm(false);
          }}
          onConfirm={() => void submit()}
        />

        <SubmitOverlay open={isSubmitting} label={t('submitting')} />
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
