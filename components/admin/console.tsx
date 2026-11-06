import type { ReactNode } from 'react';

export const controlClass =
  'h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus-visible:border-[#e7c15a]/70 focus-visible:ring-3 focus-visible:ring-[#e7c15a]/25';

export function PageHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e7c15a]">{kicker}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Banner({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-2xl border border-[#e7c15a]/30 bg-[#e7c15a]/10 px-4 py-3 text-sm text-[#f6e7b2]">{message}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
