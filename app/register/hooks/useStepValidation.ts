"use client";

import { useMemo } from 'react';
import type { FieldErrors, UseFormReturn } from 'react-hook-form';
import type { ZodIssue } from 'zod';
import { backgroundStepSchema, personalStepSchema, reviewStepSchema } from '../schema';
import type { RegisterFormValues } from '../types';

const stepFieldMap: Record<number, Array<keyof RegisterFormValues>> = {
  1: [
    'firstName',
    'lastName',
    'amharicFirstName',
    'amharicMiddleName',
    'amharicLastName',
    'fullNameAmharic',
    'sex',
    'age',
    'nationality',
    'fanNumber',
    'phone',
    'secondaryPhone',
    'phoneIsWhatsApp',
    'whatsappNumber',
    'email',
    'confirmEmail',
    'residenceRegion',
    'residenceCity',
    'residenceDetail',
  ],
  2: ['profession', 'educationLevel', 'emergencyName', 'emergencyPhone', 'emergencyRelationship', 'languages'],
  3: ['sector', 'healthSubsectors', 'bankName', 'bankAccountName', 'bankAccountNumber', 'bankAccountOtherOwner', 'ureportRegistered'],
};

export type SummaryError = { field: string; message: string };

function flattenErrors(errors: FieldErrors<RegisterFormValues>, prefix = ''): SummaryError[] {
  const messages: SummaryError[] = [];

  for (const [key, value] of Object.entries(errors)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (!value) continue;
    if ('message' in value && typeof value.message === 'string') {
      messages.push({ field, message: value.message });
      continue;
    }
    if (typeof value === 'object') {
      messages.push(...flattenErrors(value as FieldErrors<RegisterFormValues>, field));
    }
  }

  return messages;
}

export function useStepValidation(form: UseFormReturn<RegisterFormValues>) {
  const triggerStep = async (step: number) => {
    if (step === 0) {
      const agree = form.getValues('agree');
      if (!agree) {
        form.setError('agree', { message: 'Consent is required' });
        return false;
      }
      return true;
    }

    const fields = stepFieldMap[step] ?? [];
    const valid = await form.trigger(fields, { shouldFocus: true });
    if (!valid) return false;

    const values = form.getValues();

    if (step === 1) {
      const parsed = personalStepSchema.safeParse({
        ...values,
        age: values.age === '' ? undefined : Number(values.age),
        phoneIsWhatsApp: values.phoneIsWhatsApp,
      });
      if (!parsed.success) {
        parsed.error.issues.forEach((issue: ZodIssue) => {
          const fieldName = issue.path[0] as keyof RegisterFormValues;
          form.setError(fieldName, { message: issue.message });
        });
        return false;
      }
    }

    if (step === 2) {
      const parsed = backgroundStepSchema.safeParse(values);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue: ZodIssue) => {
          const fieldName = issue.path[0] as keyof RegisterFormValues;
          form.setError(fieldName, { message: issue.message });
        });
        return false;
      }
    }

    if (step === 3) {
      const parsed = reviewStepSchema.safeParse(values);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue: ZodIssue) => {
          const fieldName = issue.path[0] as keyof RegisterFormValues;
          form.setError(fieldName, { message: issue.message });
        });
        return false;
      }
    }

    return true;
  };

  const errorSummary = useMemo(() => flattenErrors(form.formState.errors), [form.formState.errors]);

  return {
    triggerStep,
    errorSummary,
  };
}
