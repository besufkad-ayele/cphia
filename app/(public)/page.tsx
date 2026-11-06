'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Handshake,
  MapPin,
  Megaphone,
  Presentation,
  Signpost,
  Ticket,
  Users,
} from 'lucide-react';
import { CphiaLogo } from '@/components/brand/cphia-logo';

const highlights = [
  { icon: Calendar, label: 'November 23–27, 2026' },
  { icon: Building2, label: 'Addis International Convention Center' },
  { icon: MapPin, label: 'Addis Ababa, Ethiopia' },
];

const reasons = [
  { icon: Users, title: 'Network with global leaders', text: 'Connect with public health pioneers, policymakers, and international delegates.' },
  { icon: Ticket, title: 'Gain inside access', text: 'Support plenary sessions, technical panels, and health innovation exhibitions.' },
  { icon: Award, title: 'Official recognition', text: 'Receive a CPHIA 2026 Certificate of Service and conference-branded attire.' },
  { icon: Briefcase, title: 'Build your career', text: 'Get hands-on experience in conference logistics and global health communication.' },
];

const roles = [
  { icon: BadgeCheck, label: 'Delegate registration & accreditation' },
  { icon: Presentation, label: 'Session & hall management' },
  { icon: Handshake, label: 'Protocol & VIP liaison' },
  { icon: Megaphone, label: 'Media & digital communications' },
  { icon: Signpost, label: 'Logistics & wayfinding' },
];

const eligibility = [
  'At least 18 years old by 1 November 2026.',
  'Able to be in Addis Ababa from 21–27 November 2026.',
  'Fluent in English or Amharic; other languages are an advantage.',
  'One registration, one device, one person.',
];

const stats = [
  ['Delegates', '30,000+'],
  ['Countries', '50+'],
  ['Sessions', '200+'],
  ['Volunteer team', '600+'],
];

const SLIDE_COUNT = 4;

function SlideToAction({
  label,
  onComplete,
}: {
  label: string;
  onComplete: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const [offset, setOffset] = useState(0);
  const [maxTravel, setMaxTravel] = useState(0);
  const [done, setDone] = useState(false);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const knob = 56;
    setMaxTravel(Math.max(0, track.clientWidth - knob - 8));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, label]);

  useEffect(() => {
    setOffset(0);
    setDone(false);
  }, [label]);

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    setOffset(maxTravel);
    window.setTimeout(() => onComplete(), 180);
  }, [done, maxTravel, onComplete]);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (done) return;
    dragging.current = true;
    startX.current = event.clientX;
    startOffset.current = offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current || done) return;
    const next = Math.min(maxTravel, Math.max(0, startOffset.current + (event.clientX - startX.current)));
    setOffset(next);
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (offset >= maxTravel * 0.82) {
      finish();
      return;
    }
    setOffset(0);
  };

  const progress = maxTravel ? offset / maxTravel : 0;

  return (
    <div
      ref={trackRef}
      className="relative h-14 w-full overflow-hidden rounded-full border border-white/30 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md"
      role="group"
      aria-label={label}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full bg-[#F5C518]/35 transition-[width] duration-75"
        style={{ width: `${Math.max(14, progress * 100)}%` }}
      />
      <p
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-sm font-semibold tracking-wide text-white transition-opacity"
        style={{ opacity: Math.max(0.2, 1 - progress * 1.35) }}
      >
        {label}
      </p>
      <button
        type="button"
        aria-label={label}
        disabled={done}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            finish();
          }
        }}
        className="absolute top-1 left-1 z-10 grid size-12 place-items-center rounded-full bg-[#F5C518] text-[#1a1a1a] shadow-lg transition-transform duration-75 touch-none select-none hover:bg-[#e6b70f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-90"
        style={{ transform: `translateX(${offset}px)` }}
      >
        <ArrowRight className="size-5" />
      </button>
    </div>
  );
}

export default function PublicHomePage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const last = index === SLIDE_COUNT - 1;

  const goToRegister = useCallback(() => {
    router.push('/register');
  }, [router]);

  const goNext = useCallback(() => {
    setIndex((value) => Math.min(value + 1, SLIDE_COUNT - 1));
  }, []);

  const goBack = useCallback(() => {
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' && !last) goNext();
      if (event.key === 'ArrowLeft') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, goNext, last]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    event.currentTarget.dataset.x = String(event.changedTouches[0]?.clientX ?? 0);
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = Number(event.currentTarget.dataset.x ?? 0);
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (delta < -48 && !last) goNext();
    if (delta > 48) goBack();
  };

  return (
    <main className="relative h-dvh overflow-hidden text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero.jpg')" }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#041816]/82 via-[#0b3a34]/76 to-[#041816]/90" />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-4 py-4 sm:px-6">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <Link href="/" className="rounded-xl bg-white px-3 py-2 shadow-sm">
            <CphiaLogo className="h-10 w-auto max-w-[170px] object-contain object-left sm:h-12 sm:max-w-[240px]" />
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/35 backdrop-blur-md hover:bg-white/25"
          >
            Register
            <ArrowRight className="size-4" />
          </Link>
        </header>

        <div
          className="relative mt-4 min-h-0 flex-1 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex h-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
            aria-live="polite"
          >
            <section className="flex h-full w-full shrink-0 flex-col justify-center overflow-y-auto pr-1" aria-label="Welcome">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#F5C518] uppercase">Volunteer opportunity</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Volunteer at CPHIA 2026 in Addis Ababa
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                Join Africa CDC and the Government of Ethiopia in welcoming 30,000+ health leaders. Register once, on this device, for the CPHIA-26 volunteer cohort.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span key={item.label} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 text-xs font-medium text-white">
                      <Icon className="size-3.5" />
                      {item.label}
                    </span>
                  );
                })}
              </div>
              <dl className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 backdrop-blur-sm">
                    <dt className="text-[11px] text-white/70">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold text-[#F5C518]">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="h-full w-full shrink-0 overflow-y-auto pr-1" aria-label="About the opportunity">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#F5C518] uppercase">About the opportunity</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Be part of a historic public health gathering</h2>
              <p className="mt-3 max-w-3xl leading-7 text-white/85">
                The 5th International Conference on Public Health in Africa (CPHIA 2026) convenes under the theme “Africa’s Health Security and Sovereignty.” Volunteers help deliver a world-class experience in Addis Ababa.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {reasons.map((reason) => {
                  const Icon = reason.icon;
                  return (
                    <article key={reason.title} className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                      <span className="grid size-10 place-items-center rounded-full bg-[#F5C518] text-[#1a1a1a]">
                        <Icon className="size-5" />
                      </span>
                      <h3 className="mt-3 text-lg font-semibold">{reason.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-white/80">{reason.text}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="h-full w-full shrink-0 overflow-y-auto pr-1" aria-label="Roles and eligibility">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Roles and eligibility</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold">Volunteer roles</h3>
                  <div className="mt-3 grid gap-2">
                    {roles.map((role) => {
                      const Icon = role.icon;
                      return (
                        <div key={role.label} className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/15 px-3 py-3 text-sm font-medium">
                          <Icon className="size-4 shrink-0 text-[#F5C518]" />
                          {role.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold">Who can apply</h3>
                  <div className="mt-3 grid gap-2">
                    {eligibility.map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-lg border border-white/15 bg-black/15 px-3 py-3 text-sm text-white/85">
                        <Check className="mt-0.5 size-4 shrink-0 text-[#F5C518]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="flex h-full w-full shrink-0 flex-col items-center justify-center overflow-y-auto px-2 text-center" aria-label="Start your application">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#F5C518] uppercase">CPHIA 2026 volunteers</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Ready to represent Ethiopia and the continent?</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                Applications close soon. Slide below to continue to registration for the CPHIA-26 volunteer cohort.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-4 grid shrink-0 gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-center gap-2" aria-label="Slide progress">
            {Array.from({ length: SLIDE_COUNT }, (_, dot) => (
              <button
                key={dot}
                type="button"
                aria-label={`Go to slide ${dot + 1}`}
                aria-current={dot === index ? 'true' : undefined}
                onClick={() => setIndex(dot)}
                className={`h-2.5 rounded-full transition-all ${dot === index ? 'w-8 bg-[#F5C518]' : 'w-2.5 bg-white/45'}`}
              />
            ))}
          </div>
          {last ? (
            <SlideToAction label="Slide to start your application" onComplete={goToRegister} />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={index === 0}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#F5C518] px-4 text-sm font-semibold text-[#1a1a1a] hover:bg-[#e6b70f]"
              >
                Next
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
