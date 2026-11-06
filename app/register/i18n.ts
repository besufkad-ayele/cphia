import { type ReactNode } from 'react';
import en from '../../messages/en.json';
import am from '../../messages/am.json';
import om from '../../messages/om.json';
import ti from '../../messages/ti.json';

export const appLocales = ['en', 'am', 'om', 'ti'] as const;
export type AppLocale = (typeof appLocales)[number];

export const localeLabels: Record<AppLocale, string> = {
  en: 'English',
  am: 'አማርኛ',
  om: 'Afaan Oromoo',
  ti: 'ትግርኛ',
};

export const localeShortLabels: Record<AppLocale, string> = {
  en: 'EN',
  am: 'AM',
  om: 'OM',
  ti: 'TI',
};

const localeMessages = { en, am, om, ti } as const;

type RegisterMessages = typeof en.register;

function getPathValue(messages: RegisterMessages, path: string): string {
  const keys = path.split('.');
  let current: unknown = messages;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : path;
}

export function getRegisterTranslations(locale: AppLocale = 'en') {
  const messages = localeMessages[locale]?.register ?? localeMessages.en.register;
  return (key: string) => getPathValue(messages, key);
}

export function RegisterIntlProvider({ children }: { locale: AppLocale; children: ReactNode }) {
  return children;
}
