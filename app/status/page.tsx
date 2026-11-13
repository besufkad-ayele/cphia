'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, Mail, MessageCircle, Search } from 'lucide-react';
import { CphiaLogo } from '@/components/brand/cphia-logo';
import { statusButtonClass } from '@/components/status/status-screen';
import {
  STATUS_SUPPORT_EMAIL,
  STATUS_SUPPORT_WHATSAPP,
  normalizeLookupPhone,
  normalizeRegistrationId,
  supportMailto,
  supportWhatsAppLink,
  type PublicStatusResult,
} from '@/app/lib/public-status';
import { cn } from '@/lib/utils';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'result'; result: PublicStatusResult };

function statusTone(status: PublicStatusResult['status']) {
  if (status === 'approved') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
  if (status === 'review') return 'border-amber-400/40 bg-amber-500/15 text-amber-50';
  if (status === 'flagged') return 'border-rose-400/40 bg-rose-500/15 text-rose-50';
  return 'border-[#F5C518]/35 bg-[#F5C518]/12 text-[#F5C518]';
}

function StatusIcon({ status }: { status: PublicStatusResult['status'] }) {
  if (status === 'approved') return <CheckCircle2 className="size-5 text-emerald-300" />;
  if (status === 'review' || status === 'flagged') return <CircleAlert className="size-5 text-amber-300" />;
  return <Clock3 className="size-5 text-[#F5C518]" />;
}

export default function StatusCheckPage() {
  const [registrationId, setRegistrationId] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });

  const contactOptions = useMemo(() => {
    if (state.kind !== 'result') {
      return {
        mailto: supportMailto({
          subject: 'CPHIA 2026 volunteer — status / improvement request',
        }),
        whatsapp: supportWhatsAppLink(),
      };
    }
    return {
      mailto: supportMailto({
        registrationId: state.result.registrationId,
        status: state.result.title,
      }),
      whatsapp: supportWhatsAppLink({
        registrationId: state.result.registrationId,
        status: state.result.title,
      }),
    };
  }, [state]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const id = normalizeRegistrationId(registrationId);
    const number = normalizeLookupPhone(phone);
    setRegistrationId(id);
    setPhone(number);
    setState({ kind: 'loading' });

    try {
      const response = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: id, phone: number }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState({
          kind: 'error',
          message: payload?.message || 'Could not check that application.',
        });
        return;
      }
      setState({ kind: 'result', result: payload.result as PublicStatusResult });
    } catch {
      setState({
        kind: 'error',
        message: 'Network error — try again in a moment.',
      });
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden text-white">
      <div aria-hidden className="absolute inset-0 bg-[#041816]" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,174,149,0.45),transparent_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <CphiaLogo
            href="/"
            className="h-10 w-auto max-w-[170px] object-contain object-left sm:h-12 sm:max-w-[220px]"
          />
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/15"
          >
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </header>

        <section className="mt-8 flex flex-1 flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F5C518]">
            New · Application status
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Check your volunteer status
          </h1>
          <p className="mt-3 text-base leading-7 text-white/80">
            Enter the registration ID from your confirmation and the phone number you registered with.
            You will see if you are approved, still under review, or not selected — plus any reason we recorded.
          </p>

          <form onSubmit={onSubmit} className="mt-8 grid gap-4 rounded-3xl border border-white/15 bg-white/8 p-5 backdrop-blur-md">
            <label className="grid gap-1.5 text-sm">
              <span className="text-white/70">Registration ID</span>
              <input
                className="h-12 rounded-xl border border-white/20 bg-black/25 px-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#F5C518]/60"
                value={registrationId}
                onChange={(event) => setRegistrationId(event.target.value)}
                placeholder="CPHIA-26-123456"
                autoComplete="off"
                inputMode="text"
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-white/70">Phone number</span>
              <input
                className="h-12 rounded-xl border border-white/20 bg-black/25 px-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#F5C518]/60"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+2519…"
                autoComplete="tel"
                inputMode="tel"
                required
              />
              <span className="text-xs text-white/45">Use the same number from your application (09… or +251…).</span>
            </label>
            <button
              type="submit"
              disabled={state.kind === 'loading'}
              className={cn(statusButtonClass('solid'), 'h-12 gap-2 disabled:opacity-60')}
            >
              <Search className="size-4" />
              {state.kind === 'loading' ? 'Checking…' : 'Check status'}
            </button>
          </form>

          {state.kind === 'error' ? (
            <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-50">
              {state.message}
            </div>
          ) : null}

          {state.kind === 'result' ? (
            <article className="mt-5 grid gap-4 rounded-3xl border border-white/15 bg-black/25 p-5 backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/50">Result</p>
                  <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                    <StatusIcon status={state.result.status} />
                    {state.result.title}
                  </h2>
                </div>
                <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold capitalize', statusTone(state.result.status))}>
                  {state.result.status === 'flagged' ? 'not selected' : state.result.status}
                </span>
              </div>

              <p className="text-sm leading-6 text-white/80">{state.result.message}</p>

              <dl className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">Registration ID</dt>
                  <dd className="font-medium text-[#F5C518]">{state.result.registrationId}</dd>
                </div>
                {state.result.sector ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/55">Sector</dt>
                    <dd className="text-white">{state.result.sector}</dd>
                  </div>
                ) : null}
              </dl>

              {state.result.reason ? (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Reason</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-50/95">
                    {state.result.reason}
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4">
                <p className="text-sm font-semibold text-white">
                  Need help or want to send updates?
                </p>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  Reach the volunteer desk with your registration ID and the improvement details.
                </p>
                <div className="mt-3 grid gap-2">
                  <a
                    href={contactOptions.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#F5C518] underline-offset-2 hover:underline"
                  >
                    <MessageCircle className="size-4 shrink-0" />
                    WhatsApp {STATUS_SUPPORT_WHATSAPP}
                  </a>
                  <a
                    href={contactOptions.mailto}
                    className="inline-flex items-center gap-2 break-all text-sm font-semibold text-[#F5C518] underline-offset-2 hover:underline"
                  >
                    <Mail className="size-4 shrink-0" />
                    {STATUS_SUPPORT_EMAIL}
                  </a>
                </div>
              </div>
            </article>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
              <p className="font-medium text-white">Questions about your result?</p>
              <p className="mt-1 leading-6">
                WhatsApp{' '}
                <a
                  href={contactOptions.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#F5C518] underline-offset-2 hover:underline"
                >
                  {STATUS_SUPPORT_WHATSAPP}
                </a>
                {' '}or email{' '}
                <a href={contactOptions.mailto} className="font-semibold text-[#F5C518] underline-offset-2 hover:underline">
                  {STATUS_SUPPORT_EMAIL}
                </a>
                {' '}to ask about your application or send corrected details.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
