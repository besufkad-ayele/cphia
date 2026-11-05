"use client";

import { Fragment, type ReactNode } from 'react';
import type { AppLocale } from '../i18n';
import { appLocales, localeLabels } from '../i18n';
import type { LanguageRow } from '../types';

export function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass-dark rounded-[var(--radius-card)] text-white ${className}`}>{children}</div>;
}

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass-light rounded-[var(--radius-card)] text-[var(--ink)] ${className}`}>{children}</section>;
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
    <main lang={locale} className="app-bg min-h-screen px-3 pb-28 pt-4 text-white md:px-6 lg:px-10">
      <header className="mx-auto flex max-w-6xl flex-col gap-3">
        <GlassPanel className="px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="m-0 text-base font-extrabold sm:text-lg">CPHIA Facility Volunteer Training</h1>
            <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
          </div>
        </GlassPanel>
      </header>
      {children}
    </main>
  );
}

export function LanguageSwitcher({ locale, onChange }: { locale: AppLocale; onChange: (locale: AppLocale) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Language switcher">
      {appLocales.map((item) => {
        const active = item === locale;
        return (
          <button
            key={item}
            type="button"
            className={`focus-ring min-h-12 rounded-full border px-3 py-2 text-sm font-bold ${active ? 'border-white bg-white text-black' : 'border-white/40 bg-white/10 text-white hover:bg-white/20'}`}
            onClick={() => onChange(item)}
          >
            {localeLabels[item]}
          </button>
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
      <GlassPanel className="mt-4 block p-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-sm">Step {step + 1} of {titles.length}</strong>
          <span className="text-xs opacity-90">{titles[step]}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/20">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold-1)] to-[var(--gold-2)]" style={{ width: `${((step + 1) / titles.length) * 100}%` }} />
        </div>
      </GlassPanel>

      <GlassPanel className="sticky top-4 hidden h-fit p-4 lg:block">
        <ol className="m-0 grid list-none gap-3 p-0">
          {titles.map((title, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={title} className={`rounded-xl border p-3 text-sm ${current ? 'border-white bg-white/20' : 'border-white/20 bg-white/5'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{title}</span>
                  <span aria-hidden>{done ? '✓' : current ? '•' : '○'}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </GlassPanel>
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
    <div className="glass-dark fixed inset-x-0 bottom-0 z-30 border-t border-white/25 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-4 lg:rounded-[var(--radius-card)] lg:border lg:p-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!canBack}
          className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-white/50 bg-white/10 px-4 font-semibold text-white disabled:opacity-40"
        >
          {backLabel}
        </button>
        <GoldButton type="button" onClick={onNext} disabled={disabled}>
          {nextLabel}
        </GoldButton>
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
    <label htmlFor={id} className="grid gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-black">
        {icon}
        {label}
      </span>
      <div aria-describedby={describedBy}>{children}</div>
      {hint ? <span id={`${id}-hint`} className="text-xs text-black/75">{hint}</span> : null}
      {error ? <span id={`${id}-error`} className="text-sm font-semibold text-[#B42318]">⚠ {error}</span> : null}
    </label>
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
    <div className={`flex min-h-12 items-center rounded-[var(--radius-field)] border bg-white px-2 ${error ? 'border-[#B42318]' : 'border-black/20'}`}>
      <span className="rounded-full bg-black/10 px-3 py-1 text-sm font-bold text-black">+251</span>
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
        className="focus-ring h-10 w-full border-none bg-transparent px-3 text-base text-black outline-none"
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
      <input
        id={id}
        list={`${id}-list`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring min-h-12 w-full rounded-[var(--radius-field)] border border-black/20 bg-white px-3 text-black"
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
    <div className="grid min-h-12 grid-cols-2 gap-2 rounded-[var(--radius-field)] border border-black/20 p-1">
      {options.map((option) => (
        <button
          key={`${name}-${option}`}
          type="button"
          onClick={() => onChange(option)}
          className={`focus-ring rounded-[10px] px-3 py-2 text-sm font-bold ${value === option ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/5'}`}
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
      className={`focus-ring min-h-12 rounded-[var(--radius-field)] border px-4 py-3 text-left text-sm font-bold ${checked ? 'border-black bg-black text-white' : 'border-black/20 bg-white text-black hover:bg-black/5'}`}
    >
      {checked ? '◉ ' : '○ '} {label}
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
      className={`focus-ring min-h-12 rounded-full border px-4 text-sm font-bold ${selected ? 'border-black bg-black text-white' : 'border-black/20 bg-white text-black hover:bg-black/5'}`}
    >
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
}: {
  photoUrl: string | null;
  photoName?: string;
  sizeLabel?: string;
  onTake: () => void;
  onChoose: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-field)] border border-dashed border-black/30 bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt="Preview" className="h-20 w-20 rounded-full border border-black/20 object-cover" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-full border border-black/20 bg-black/5 text-xs font-bold text-black">Optional</div>
        )}
        <div className="grid gap-2">
          <div className="text-sm font-semibold text-black">{photoName ?? 'No photo selected'}</div>
          {sizeLabel ? <div className="text-xs text-black/70">{sizeLabel}</div> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onTake} className="focus-ring min-h-12 rounded-full border border-black/20 bg-white px-4 text-sm font-bold text-black">Take photo</button>
            <button type="button" onClick={onChoose} className="focus-ring min-h-12 rounded-full border border-black/20 bg-white px-4 text-sm font-bold text-black">Choose from gallery</button>
            {photoUrl ? <button type="button" onClick={onRemove} className="focus-ring min-h-12 rounded-full border border-[#B42318]/40 bg-white px-4 text-sm font-bold text-[#B42318]">Remove</button> : null}
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

  const renderGroup = (group: LanguageRow['group'], title: string) => {
    const languages = rows.filter((row) => row.group === group);
    return (
      <div className="grid gap-3">
        <div className="text-sm font-extrabold text-black">{title}</div>
        <div className="flex flex-wrap gap-2">
          {languages.map((item) => (
            <div key={item.id} className="grid gap-2">
              <ToggleChip selected={item.selected} label={item.language || 'Custom language'} onClick={() => onToggle(item.id)} />
              {item.group === 'other' ? (
                <div className="flex items-center gap-2">
                  <input
                    value={item.language}
                    onChange={(event) => onRename(item.id, event.target.value)}
                    className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-black/20 bg-white px-3 text-black"
                    placeholder="Language name"
                  />
                  <button type="button" onClick={() => onRemove(item.id)} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-[#B42318]/40 bg-white px-3 text-sm font-bold text-[#B42318]">Remove</button>
                </div>
              ) : null}
              {item.selected ? (
                <SegmentedControl
                  name={`prof-${item.id}`}
                  value={item.proficiency}
                  options={['Basic', 'Conversational', 'Fluent', 'Native']}
                  onChange={(value) => onProficiency(item.id, value as LanguageRow['proficiency'])}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="text-sm font-bold text-black">{selected} languages selected</div>
      {renderGroup('ethiopian', 'Ethiopian languages')}
      {renderGroup('un', 'UN official languages')}
      {renderGroup('other', 'Other languages')}
      <button type="button" onClick={onAddOther} className="focus-ring min-h-12 w-fit rounded-full border border-black/20 bg-white px-4 font-bold text-black">Add another language</button>
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
          className={`focus-ring min-h-14 rounded-[var(--radius-field)] border px-4 text-left font-bold ${value === option ? 'border-black bg-black text-white' : 'border-black/20 bg-white text-black hover:bg-black/5'}`}
        >
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
    <div className="rounded-[var(--radius-field)] border border-black/15 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-base font-extrabold text-black">{title}</h3>
        <button type="button" onClick={onEdit} className="focus-ring min-h-12 rounded-full border border-black/20 px-4 text-sm font-bold text-black">Edit</button>
      </div>
      <div className="grid gap-1 text-sm text-black">{children}</div>
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <GlassPanel className="w-full max-w-md p-4">
        <p className="m-0 text-sm leading-6 text-white">{title}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="focus-ring min-h-12 rounded-[var(--radius-field)] border border-white/40 px-4 font-bold text-white">Cancel</button>
          <GoldButton type="button" onClick={onConfirm}>Confirm</GoldButton>
        </div>
      </GlassPanel>
    </div>
  );
}

export function SubmitOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" aria-live="polite">
      <GlassPanel className="w-full max-w-md p-5 text-center">
        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="m-0 text-sm font-bold">Submitting, please do not close this page</p>
      </GlassPanel>
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
    <GlassPanel className="mx-auto mt-8 max-w-xl p-6 text-center">
      <p className="m-0 text-sm font-bold uppercase tracking-wide">{title}</p>
      <h2 className="my-3 text-3xl font-black">{registrationId}</h2>
      <p className="m-0 text-sm text-white/90">{subtitle}</p>
    </GlassPanel>
  );
}

export function ErrorSummary({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-[var(--radius-field)] border border-[#B42318]/40 bg-[#fff1f1] p-3 text-black" role="alert" aria-live="assertive">
      <p className="m-0 text-sm font-extrabold text-[#B42318]">Please fix the following:</p>
      <ul className="mb-0 mt-2 list-disc pl-5 text-sm text-[#8b1c13]">
        {errors.slice(0, 6).map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
