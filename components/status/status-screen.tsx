import type { ReactNode } from 'react';
import Link from 'next/link';
import { CphiaLogo } from '@/components/brand/cphia-logo';

export function StatusScreen({
  code,
  title,
  description,
  children,
  note,
}: {
  code: string;
  title: string;
  description: string;
  children?: ReactNode;
  note?: string;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10 text-white">
      <div aria-hidden className="absolute inset-0 bg-[#041816]" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,174,149,0.5),transparent_52%)]"
      />
      <div className="relative z-10 w-full max-w-lg text-center">
        <div className="mx-auto inline-flex">
          <CphiaLogo href="/" className="h-10 w-auto max-w-[180px] object-contain sm:h-12 sm:max-w-[220px]" />
        </div>
        <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-[#F5C518] uppercase">{code}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base leading-7 text-white/80">{description}</p>
        {children ? <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
        {note ? <p className="mt-6 font-mono text-xs text-white/55">{note}</p> : null}
      </div>
    </main>
  );
}

export function statusButtonClass(tone: 'solid' | 'ghost' = 'solid') {
  if (tone === 'ghost') {
    return 'inline-flex h-11 items-center justify-center rounded-lg bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/35 backdrop-blur-md hover:bg-white/25';
  }
  return 'inline-flex h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-[#041816] hover:bg-white/90';
}
