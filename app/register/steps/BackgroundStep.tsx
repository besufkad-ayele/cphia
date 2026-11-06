"use client";

import type { UseFormReturn } from 'react-hook-form';
import { Combobox, Field, LanguagePicker, PhoneInput } from '../components/ui';
import { educationOptions, professionSuggestions } from '../constants';
import { getRegisterTranslations } from '../i18n';
import type { LanguageRow, RegisterFormValues } from '../types';

export function BackgroundStep({ form }: { form: UseFormReturn<RegisterFormValues> }) {
  const values = form.watch();
  const t = getRegisterTranslations(values.uiLanguage);
  const languages = values.languages;

  const updateLanguage = (id: string, patch: Partial<LanguageRow>) => {
    form.setValue(
      'languages',
      languages.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <div className="grid gap-4">
      <h2 className="m-0 text-xl font-black text-black">{t('step2')}</h2>
      <Field id="profession" label={t('form.profession')} error={form.formState.errors.profession?.message}>
        <Combobox id="profession" value={values.profession} options={professionSuggestions} onChange={(value) => form.setValue('profession', value, { shouldDirty: true, shouldValidate: true })} />
      </Field>
      <Field id="educationLevel" label={t('form.education')} error={form.formState.errors.educationLevel?.message}>
        <select id="educationLevel" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.educationLevel} onChange={(e) => form.setValue('educationLevel', e.target.value as RegisterFormValues['educationLevel'], { shouldDirty: true, shouldValidate: true })}>
          <option value="">Select</option>
          {educationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="emergencyName" label={t('form.emergencyName')} error={form.formState.errors.emergencyName?.message}>
          <input id="emergencyName" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.emergencyName} onChange={(e) => form.setValue('emergencyName', e.target.value, { shouldDirty: true, shouldValidate: true })} />
        </Field>
        <Field id="emergencyPhone" label={t('form.emergencyPhone')} error={form.formState.errors.emergencyPhone?.message}>
          <PhoneInput id="emergencyPhone" value={values.emergencyPhone} onChange={(value) => form.setValue('emergencyPhone', value, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.emergencyPhone?.message} />
        </Field>
        <Field id="emergencyRelationship" label={t('form.emergencyRelationship')} error={form.formState.errors.emergencyRelationship?.message}>
          <input id="emergencyRelationship" className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 px-3" value={values.emergencyRelationship} onChange={(e) => form.setValue('emergencyRelationship', e.target.value, { shouldDirty: true, shouldValidate: true })} />
        </Field>
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
          onAddOther={() => form.setValue('languages', [...languages, {
            id: crypto.randomUUID(),
            group: 'other',
            language: '',
            selected: true,
            proficiency: 'Basic',
          }], { shouldDirty: true, shouldValidate: true })}
          onRemove={(id) => form.setValue('languages', languages.filter((row) => row.id !== id), { shouldDirty: true, shouldValidate: true })}
        />
      </Field>
    </div>
  );
}
