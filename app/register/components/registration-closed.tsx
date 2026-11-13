'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CphiaLogo } from '@/components/brand/cphia-logo';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';
import type { AppLocale } from '../i18n';
import { getRegisterTranslations } from '../i18n';
import { AppShell } from './ui';

export function RegistrationClosed({
  locale,
  onLocaleChange,
}: {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
}) {
  const t = getRegisterTranslations(locale);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <AppShell locale={locale} onLocaleChange={onLocaleChange}>
      <section
        className={cn(
          'relative mx-auto flex min-h-[calc(100dvh-7.5rem)] max-w-3xl flex-col items-center justify-center px-2 text-center sm:px-4',
          'transition-[opacity,transform] duration-700 ease-out',
          entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
        aria-labelledby="registration-closed-title"
      >
        <div
          className={cn(
            'mb-8 transition-transform duration-1000 ease-out',
            entered ? 'scale-100' : 'scale-95',
          )}
        >
          <CphiaLogo
            href="/"
            priority
            className="mx-auto h-14 w-auto max-w-[min(88vw,280px)] object-contain object-center sm:h-16 sm:max-w-[320px]"
          />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e7c15a]">
          {t('closed.kicker')}
        </p>

        <h1
          id="registration-closed-title"
          className="font-heading mt-4 max-w-xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
        >
          {t('closed.title')}
        </h1>

        <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
          {t('closed.body')}
        </p>

        <div
          className={cn(
            'mt-8 h-px w-16 origin-center bg-gradient-to-r from-transparent via-[#e7c15a] to-transparent transition-transform delay-200 duration-700',
            entered ? 'scale-x-100' : 'scale-x-0',
          )}
          aria-hidden
        />

        <p className="mt-8 max-w-sm text-sm leading-relaxed text-white/55">
          {t('closed.registeredHint')}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={href('/status')}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#F5C518] px-6 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#e6b70f]"
          >
            Check application status
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/35 hover:bg-white/15"
          >
            {t('closed.homeCta')}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
