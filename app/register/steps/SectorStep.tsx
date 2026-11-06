"use client";

import { useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { FEATURED_BANKS, MORE_BANKS, RECOMMENDED_BANK } from '@cphia/shared/constants';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MAX_UPLOAD_LABEL } from '@/app/lib/uploads';
import { ImageField } from '../components/image-field';
import { Field, RadioCard, SectorPicker, ToggleChip } from '../components/ui';
import { healthSubsectorOptions, sectorOptions } from '../constants';
import { getRegisterTranslations } from '../i18n';
import type { RegisterFormValues, StoredPhoto } from '../types';

export function SectorStep({
  form,
  ureportUrl,
  ureportPhoto,
  ureportError,
  onUploadUreport,
  onRemoveUreport,
  bankOwnerPhoto,
  bankOwnerPhotoUrl,
  bankOwnerPhotoError,
  onUploadBankOwnerPhoto,
  onRemoveBankOwnerPhoto,
}: {
  form: UseFormReturn<RegisterFormValues>;
  ureportUrl: string | null;
  ureportPhoto: StoredPhoto | null;
  ureportError: string | null;
  onUploadUreport: (file: File | null) => void;
  onRemoveUreport: () => void;
  bankOwnerPhoto: StoredPhoto | null;
  bankOwnerPhotoUrl: string | null;
  bankOwnerPhotoError: string | null;
  onUploadBankOwnerPhoto: (file: File | null) => void;
  onRemoveBankOwnerPhoto: () => void;
}) {
  const values = form.watch();
  const t = getRegisterTranslations(values.uiLanguage);
  const [bankOpen, setBankOpen] = useState(false);
  const [showMoreBanks, setShowMoreBanks] = useState(
    Boolean(values.bankName) && !(FEATURED_BANKS as readonly string[]).includes(values.bankName),
  );
  const ureportRef = useRef<HTMLInputElement | null>(null);
  const banks = showMoreBanks ? [...FEATURED_BANKS, ...MORE_BANKS] : [...FEATURED_BANKS];

  return (
    <div className="grid gap-5">
      <h2 className="m-0 text-xl font-semibold">{t('step3')}</h2>
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
        <Field id="healthSubsectors" label={t('form.healthSubsector')} hint="Select one" error={form.formState.errors.healthSubsectors?.message as string | undefined}>
          <div className="flex flex-wrap gap-2">
            {healthSubsectorOptions.map((item) => (
              <ToggleChip
                key={item}
                selected={values.healthSubsectors[0] === item}
                label={item}
                onClick={() => form.setValue('healthSubsectors', [item], { shouldDirty: true, shouldValidate: true })}
              />
            ))}
          </div>
        </Field>
      ) : null}

      <Field id="bankName" label={t('form.bank')} hint={`Recommended: ${RECOMMENDED_BANK}`} error={form.formState.errors.bankName?.message}>
        <Button type="button" variant="outline" className="h-12 w-full justify-between" onClick={() => setBankOpen(true)}>
          <span>{values.bankName || 'Choose your bank'}</span>
          <span className="text-xs text-muted-foreground">Change</span>
        </Button>
      </Field>

      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select a bank</DialogTitle>
            <DialogDescription>Commercial Bank of Ethiopia is recommended for volunteer payments.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 gap-2 overflow-y-auto">
            {banks.map((bank) => (
              <button
                key={bank}
                type="button"
                onClick={() => {
                  form.setValue('bankName', bank, { shouldDirty: true, shouldValidate: true });
                  setBankOpen(false);
                }}
                className={`min-h-12 rounded-lg border px-3 text-left text-sm font-medium ${values.bankName === bank ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-muted'}`}
              >
                {bank}
                {bank === RECOMMENDED_BANK ? <span className="ml-2 text-xs opacity-80">Recommended</span> : null}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" className="h-11" onClick={() => setShowMoreBanks((value) => !value)}>
            {showMoreBanks ? 'Show fewer banks' : 'Show more banks'}
          </Button>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="bankAccountName" label={t('form.bankAccountName')} error={form.formState.errors.bankAccountName?.message}>
          <Input
            id="bankAccountName"
            className="h-11"
            value={values.bankAccountName}
            onChange={(event) => form.setValue('bankAccountName', event.target.value, { shouldDirty: true, shouldValidate: true })}
          />
        </Field>
        <Field id="bankAccountNumber" label={t('form.bankAccountNumber')} error={form.formState.errors.bankAccountNumber?.message}>
          <Input
            id="bankAccountNumber"
            className="h-11"
            inputMode="numeric"
            value={values.bankAccountNumber}
            onChange={(event) => form.setValue('bankAccountNumber', event.target.value.replace(/\D/g, '').slice(0, 30), { shouldDirty: true, shouldValidate: true })}
          />
        </Field>
      </div>

      <label className="flex min-h-12 items-start gap-3 rounded-xl border p-3">
        <Checkbox
          checked={values.bankAccountOtherOwner}
          onCheckedChange={(checked) => {
            const next = Boolean(checked);
            form.setValue('bankAccountOtherOwner', next, { shouldDirty: true, shouldValidate: true });
            if (!next) onRemoveBankOwnerPhoto();
          }}
        />
        <span>
          <span className="block text-sm font-medium">{t('form.bankOtherOwner')}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{t('form.bankOtherOwnerHint')}</span>
        </span>
      </label>
      {values.bankAccountOtherOwner ? (
        <ImageField
          id="bankOwnerIdPhoto"
          label={t('form.bankOwnerIdPhoto')}
          hint={t('form.bankOwnerIdPhotoHint')}
          required
          variant="document"
          photo={bankOwnerPhoto}
          photoUrl={bankOwnerPhotoUrl}
          error={bankOwnerPhotoError ?? undefined}
          onUpload={onUploadBankOwnerPhoto}
          onRemove={onRemoveBankOwnerPhoto}
        />
      ) : null}

      <Field id="ureportRegistered" label={t('form.ureport')} error={form.formState.errors.ureportRegistered?.message}>
        <div className="grid gap-2 sm:grid-cols-2">
          <RadioCard
            checked={values.ureportRegistered === true}
            label={t('form.yes')}
            onClick={() => form.setValue('ureportRegistered', true, { shouldDirty: true, shouldValidate: true })}
          />
          <RadioCard
            checked={values.ureportRegistered === false}
            label={t('form.no')}
            onClick={() => {
              form.setValue('ureportRegistered', false, { shouldDirty: true, shouldValidate: true });
              onRemoveUreport();
            }}
          />
        </div>
      </Field>

      {values.ureportRegistered ? (
        <Field id="ureportScreenshot" label={t('form.ureportScreenshot')} hint={`JPG, PNG, WEBP, or PDF · max ${MAX_UPLOAD_LABEL}`} error={ureportError ?? undefined}>
          {ureportUrl || ureportPhoto ? (
            <div className="grid gap-2">
              {ureportPhoto?.type === 'application/pdf' || ureportPhoto?.fileName.toLowerCase().endsWith('.pdf') ? (
                <div className="flex h-32 items-center justify-center rounded-lg border bg-muted text-sm font-medium text-muted-foreground">
                  PDF selected: {ureportPhoto?.fileName ?? 'document.pdf'}
                </div>
              ) : ureportUrl ? (
                <img src={ureportUrl} alt="U-Report screenshot" className="h-32 w-full rounded-lg object-cover" />
              ) : null}
              <Button type="button" variant="outline" className="h-11 w-fit" onClick={onRemoveUreport}>Remove file</Button>
            </div>
          ) : (
            <Button type="button" variant="outline" className="h-11" onClick={() => ureportRef.current?.click()}>
              Upload U-Report file
            </Button>
          )}
          <input
            ref={ureportRef}
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => onUploadUreport(event.target.files?.[0] ?? null)}
          />
        </Field>
      ) : null}
    </div>
  );
}
