"use client";

import type { UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getRegisterTranslations } from '../i18n';
import type { RegisterFormValues } from '../types';

export function ConsentStep({
  form,
}: {
  form: UseFormReturn<RegisterFormValues>;
  onContinue: () => void;
}) {
  const t = getRegisterTranslations(form.getValues('uiLanguage'));
  const agree = form.watch('agree');

  return (
    <div className="grid gap-4 p-1">
      <h2 className="m-0 text-2xl font-semibold">{t('consentTitle')}</h2>
      <p className="m-0 text-muted-foreground">{t('consentNote')}</p>
      <Alert>
        <AlertTitle>{t('consentWarning')}</AlertTitle>
        <AlertDescription>One person, one device, one CPHIA-26 volunteer registration.</AlertDescription>
      </Alert>
      <div className="grid gap-2">
        <span className="text-sm font-medium">{t('haveReady')}</span>
        <ul className="m-0 list-disc pl-5 text-sm text-muted-foreground">
          <li>16-digit national ID (FAN) and a photo of that ID</li>
          <li>Professional passport-style photo for the event ID</li>
          <li>Phone, email, and bank details</li>
          <li>U-Report screenshot if you are registered</li>
        </ul>
      </div>

      <label className="flex min-h-12 items-start gap-3 rounded-xl border p-3">
        <Checkbox
          checked={agree}
          onCheckedChange={(checked) => form.setValue('agree', Boolean(checked), { shouldValidate: true, shouldDirty: true })}
        />
        <span className="text-sm font-medium">{t('agree')}</span>
      </label>
    </div>
  );
}
