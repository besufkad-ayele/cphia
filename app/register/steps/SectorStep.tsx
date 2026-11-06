"use client";

import type { UseFormReturn } from 'react-hook-form';
import { Field, SectorPicker, ToggleChip } from '../components/ui';
import { healthSubsectorOptions, sectorOptions } from '../constants';
import { getRegisterTranslations } from '../i18n';
import type { RegisterFormValues } from '../types';

export function SectorStep({ form }: { form: UseFormReturn<RegisterFormValues> }) {
  const values = form.watch();
  const t = getRegisterTranslations(values.uiLanguage);

  return (
    <div className="grid gap-4">
      <h2 className="m-0 text-xl font-black text-black">{t('step3')}</h2>
      <Field id="sector" label={t('form.sector')} error={form.formState.errors.sector?.message}>
        <SectorPicker
          options={sectorOptions}
          value={values.sector}
          onChange={(value) => {
            form.setValue('sector', value as RegisterFormValues['sector'], { shouldDirty: true, shouldValidate: true });
            if (value !== 'Health') {
              form.setValue('healthSubsectors', [], { shouldDirty: true, shouldValidate: true });
            }
          }}
        />
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
  );
}
