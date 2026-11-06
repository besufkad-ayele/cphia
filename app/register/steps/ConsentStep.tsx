"use client";

import type { UseFormReturn } from 'react-hook-form';
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
          checked={agree}
          onChange={(event) => form.setValue('agree', event.target.checked, { shouldValidate: true, shouldDirty: true })}
        />
        <span className="text-sm font-semibold">{t('agree')}</span>
      </label>
    </div>
  );
}
