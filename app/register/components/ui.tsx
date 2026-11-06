"use client";

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Camera, Check, CircleAlert, ImageIcon, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CphiaLogo } from '@/components/brand/cphia-logo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AppLocale } from '../i18n';
import { appLocales, localeLabels, localeShortLabels } from '../i18n';
import { resolveFieldLabel } from '../lib/errorLabels';
import type { LanguageRow } from '../types';

export const fieldClass =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const choiceOn = 'border-primary bg-secondary text-secondary-foreground';
const choiceOff = 'border-input bg-background text-foreground hover:bg-muted';

export function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass-dark rounded-[var(--radius-card)] text-white ${className}`}>{children}</div>;
}

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Card className={`bg-card text-card-foreground ${className}`}>{children}</Card>;
}

export function AppShell({
  locale,
  onLocaleChange,
  children,
}: {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
  children: ReactNode;
}) {
  return (
    <main lang={locale} className="min-h-screen bg-muted/40 px-3 pb-36 pt-[calc(4.75rem+env(safe-area-inset-top))] md:px-6 md:pt-[calc(5.25rem+env(safe-area-inset-top))] lg:px-10">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 bg-white/65 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/45">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 md:px-6 lg:px-10">
          <Link href="/" className="w-fit shrink-0 rounded-xl bg-white/80 px-2 py-1.5 ring-1 ring-black/5 backdrop-blur-sm">
            <CphiaLogo className="h-10 w-auto max-w-[160px] object-contain object-left sm:h-12 sm:max-w-[280px]" />
          </Link>
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
        </div>
      </header>
      <div className="pt-4">{children}</div>
    </main>
  );
}

export function LanguageSwitcher({ locale, onChange }: { locale: AppLocale; onChange: (locale: AppLocale) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-label="Language switcher">
      {appLocales.map((item) => {
        const active = item === locale;
        return (
          <Button
            key={item}
            type="button"
            variant={active ? 'secondary' : 'outline'}
            className="h-9 min-w-11 px-2.5 text-xs font-semibold tracking-wide text-foreground"
            aria-label={localeLabels[item]}
            title={localeLabels[item]}
            aria-pressed={active}
            onClick={() => onChange(item)}
          >
            {localeShortLabels[item]}
          </Button>
        );
      })}
    </div>
  );
}

export function Stepper({
  step,
  titles,
}: {
  step: number;
  titles: string[];
}) {
  return (
    <Fragment>
      <Card className="sticky top-[calc(4.75rem+env(safe-area-inset-top))] z-30 block border-white/50 bg-white/65 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl backdrop-saturate-150 md:top-[calc(5.25rem+env(safe-area-inset-top))] lg:hidden supports-[backdrop-filter]:bg-white/45">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-sm">Step {step + 1} of {titles.length}</strong>
          <span className="text-xs text-muted-foreground">{titles[step]}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted">
          <div className="h-full rounded-full bg-accent" style={{ width: `${((step + 1) / titles.length) * 100}%` }} />
        </div>
      </Card>

      <Card className="sticky top-[calc(5.25rem+env(safe-area-inset-top))] hidden h-fit border-white/50 bg-white/65 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl backdrop-saturate-150 lg:block supports-[backdrop-filter]:bg-white/45">
        <ol className="m-0 grid list-none gap-3 p-0">
          {titles.map((title, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={title} className={`flex items-center gap-3 rounded-xl px-2 py-2 text-sm ${current ? 'bg-secondary' : ''}`}>
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${done ? 'bg-primary text-primary-foreground' : current ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className={current ? 'font-semibold' : 'text-muted-foreground'}>{title}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </Fragment>
  );
}

export function StepFooter({
  canBack,
  backLabel,
  onBack,
  nextLabel,
  onNext,
  disabled,
}: {
  canBack: boolean;
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  onNext: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/50 bg-white/65 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/45">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Button type="button" variant="outline" className="h-12 border-primary/40 bg-white/80 text-foreground hover:bg-secondary" onClick={onBack} disabled={!canBack}>
          <ArrowLeft />
          {backLabel}
        </Button>
        <Button type="button" className="h-12" onClick={onNext} disabled={disabled}>
          {nextLabel}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  icon,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm">
        {icon}
        {label}
      </Label>
      <div aria-describedby={describedBy}>{children}</div>
      {hint ? <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span> : null}
      {error ? (
        <span id={`${id}-error`} className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <CircleAlert className="size-3.5" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function PhoneInput({
  value,
  onChange,
  id,
  placeholder,
  error,
}: {
  id: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const local = value.replace('+251', '');
  const formatLocal = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    const chunks = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)].filter(Boolean);
    return chunks.join(' ');
  };

  return (
    <div className={`flex h-11 items-center rounded-lg border bg-background px-2 ${error ? 'border-destructive' : 'border-input'}`}>
      <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">+251</span>
      <input
        id={id}
        value={formatLocal(local)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 9);
          onChange(`+251${digits}`);
        }}
        inputMode="numeric"
        autoComplete="tel-national"
        enterKeyHint="next"
        className="h-9 w-full border-none bg-transparent px-2 text-base text-foreground outline-none"
        placeholder={placeholder ?? '9X XXX XXXX'}
      />
    </div>
  );
}

export function Combobox({
  id,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Input
        id={id}
        list={`${id}-list`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11"
        placeholder={placeholder}
      />
      <datalist id={`${id}-list`}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

export function SegmentedControl({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-h-11 grid-cols-2 gap-2 rounded-lg border border-input bg-background p-1">
      {options.map((option) => (
        <button
          key={`${name}-${option}`}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-md px-3 py-2 text-sm font-medium ${value === option ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function RadioCard({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium ${checked ? choiceOn : choiceOff}`}
    >
      <span className={`grid size-4 place-items-center rounded-full border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}>
        {checked ? <Check className="size-3" /> : null}
      </span>
      {label}
    </button>
  );
}

export function ToggleChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${selected ? choiceOn : choiceOff}`}
    >
      {selected ? <Check className="size-3.5 text-primary" /> : null}
      {label}
    </button>
  );
}

export function PhotoUpload({
  photoUrl,
  photoName,
  sizeLabel,
  onTake,
  onChoose,
  onRemove,
  required = false,
  variant = 'portrait',
}: {
  photoUrl: string | null;
  photoName?: string;
  sizeLabel?: string;
  onTake: () => void;
  onChoose: () => void;
  onRemove: () => void;
  required?: boolean;
  variant?: 'portrait' | 'document';
}) {
  return (
    <div className="rounded-xl border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Preview"
            className={variant === 'document' ? 'h-20 w-32 rounded-md border object-cover' : 'h-28 w-20 rounded-md border object-cover object-top'}
          />
        ) : (
          <div className={`grid place-items-center gap-1 rounded-md border bg-muted text-muted-foreground ${variant === 'document' ? 'h-20 w-32' : 'h-28 w-20'}`}>
            {variant === 'document' ? <ImageIcon className="size-5" /> : <User className="size-5" />}
            <span className="text-[10px] font-medium">{required ? 'Required' : 'Optional'}</span>
          </div>
        )}
        <div className="grid gap-2">
          <div className="text-sm font-medium">{photoName ?? 'No image selected'}</div>
          {sizeLabel ? <div className="text-xs text-muted-foreground">{sizeLabel}</div> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={onTake}><Camera /> Take photo</Button>
            <Button type="button" variant="outline" className="h-11" onClick={onChoose}><ImageIcon /> Gallery</Button>
            {photoUrl ? <Button type="button" variant="destructive" className="h-11" onClick={onRemove}>Remove</Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LanguagePicker({
  rows,
  onToggle,
  onProficiency,
  onRename,
  onAddOther,
  onRemove,
}: {
  rows: LanguageRow[];
  onToggle: (id: string) => void;
  onProficiency: (id: string, value: LanguageRow['proficiency']) => void;
  onRename: (id: string, value: string) => void;
  onAddOther: () => void;
  onRemove: (id: string) => void;
}) {
  const selected = rows.filter((row) => row.selected && row.language.trim()).length;
  const ethiopian = rows.filter((row) => row.group === 'ethiopian');
  const ethiopianSelected = ethiopian.filter((row) => row.selected).length;

  const renderLanguage = (item: LanguageRow) => (
    <div key={item.id} className="grid gap-2 rounded-lg border p-3">
      {item.group === 'other' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={item.language}
            onChange={(event) => onRename(item.id, event.target.value)}
            className="h-11 min-w-40 flex-1"
            placeholder="Language name"
          />
          <Button type="button" variant="destructive" className="h-11" onClick={() => onRemove(item.id)}>Remove</Button>
        </div>
      ) : (
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <Checkbox checked={item.selected} onCheckedChange={() => onToggle(item.id)} />
          {item.language}
        </label>
      )}
      {item.selected ? (
        <SegmentedControl
          name={`prof-${item.id}`}
          value={item.proficiency}
          options={['Basic', 'Conversational', 'Fluent', 'Native']}
          onChange={(value) => onProficiency(item.id, value as LanguageRow['proficiency'])}
        />
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="text-sm font-medium text-muted-foreground">{selected} languages selected</div>
      <div className="grid gap-2">
        <div className="text-sm font-semibold">International and continental languages</div>
        {rows.filter((row) => row.group === 'un').map(renderLanguage)}
      </div>
      <div className="grid gap-2">
        <div className="text-sm font-semibold">Other languages</div>
        {rows.filter((row) => row.group === 'other').map(renderLanguage)}
        <Button type="button" variant="outline" className="h-11 w-fit text-foreground" onClick={onAddOther}>Add another language</Button>
      </div>
      <details open className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Ethiopian languages {ethiopianSelected ? `(${ethiopianSelected} selected)` : ''}
        </summary>
        <div className="mt-3 grid gap-2">{ethiopian.map(renderLanguage)}</div>
      </details>
    </div>
  );
}

export function SectorPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex min-h-14 items-center gap-2 rounded-lg border px-4 text-left text-sm font-medium ${value === option ? choiceOn : choiceOff}`}
        >
          {value === option ? <Check className="size-4 text-primary" /> : null}
          {option}
        </button>
      ))}
    </div>
  );
}

export function ReviewSection({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        <Button type="button" variant="outline" className="h-9" onClick={onEdit}>Edit</Button>
      </div>
      <div className="grid gap-1 text-sm">{children}</div>
    </div>
  );
}

export function GoldButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring min-h-12 rounded-[var(--radius-field)] bg-gradient-to-r from-[var(--gold-1)] to-[var(--gold-2)] px-5 font-extrabold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_20px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {children}
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit registration</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={onCancel}>Cancel</Button>
          <Button type="button" className="h-11" onClick={onConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubmitOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" aria-live="polite">
      <Card className="w-full max-w-md p-5 text-center">
        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="m-0 text-sm font-semibold">Submitting, please do not close this page</p>
      </Card>
    </div>
  );
}

export function IdCard({
  registrationId,
  title,
  subtitle,
}: {
  registrationId: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Card className="mx-auto mt-8 max-w-xl p-6 text-center">
      <p className="m-0 text-sm font-semibold uppercase tracking-wide text-primary">{title}</p>
      <h2 className="my-3 text-3xl font-semibold">{registrationId}</h2>
      <p className="m-0 text-sm text-muted-foreground">{subtitle}</p>
    </Card>
  );
}

export function ErrorSummary({ errors }: { errors: Array<{ field: string; message: string }> }) {
  if (!errors.length) return null;
  return (
    <Alert variant="destructive" role="alert" aria-live="assertive">
      <AlertTitle>Please fix the following:</AlertTitle>
      <AlertDescription>
      <ul className="mb-0 mt-2 list-disc pl-5">
        {errors.slice(0, 6).map((error) => (
          <li key={`${error.field}:${error.message}`}>{`${resolveFieldLabel(error.field)}: ${error.message}`}</li>
        ))}
      </ul>
      </AlertDescription>
    </Alert>
  );
}
