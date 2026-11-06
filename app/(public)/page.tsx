'use client';

import { useCallback, useEffect, useState, type TouchEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
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

export default function PublicHomePage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const last = index === SLIDE_COUNT - 1;

  const goToRegister = useCallback(() => {
    router.push('/register');
  }, [router]);

  const goNext = useCallback(() => {
    setPaused(true);
    setIndex((value) => Math.min(value + 1, SLIDE_COUNT - 1));
  }, []);

  const goBack = useCallback(() => {
    setPaused(true);
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  useEffect(() => {
    if (paused || last) return;
    const timer = window.setTimeout(() => {
      setIndex((value) => Math.min(value + 1, SLIDE_COUNT - 1));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [index, last, paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, goNext]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    event.currentTarget.dataset.x = String(event.changedTouches[0]?.clientX ?? 0);
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = Number(event.currentTarget.dataset.x ?? 0);
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (delta < -48) goNext();
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
        <header className="flex shrink-0 items-center gap-4">
          <Link href="/" className="rounded-xl bg-white px-3 py-2 shadow-sm">
            <CphiaLogo className="h-10 w-auto max-w-[170px] object-contain object-left sm:h-12 sm:max-w-[240px]" />
          </Link>
          <p className="text-xs font-semibold tracking-[0.16em] text-[#F5C518] uppercase sm:text-sm">Start your application</p>
        </header>

        <div
          className="relative mt-3 min-h-0 flex-1"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="h-full overflow-hidden rounded-3xl border border-white/15 bg-black/20 shadow-2xl backdrop-blur-[2px]">
            <div
              className="flex h-full transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
              aria-live="polite"
            >
              <section className="flex h-full w-full shrink-0 flex-col justify-center overflow-y-auto px-16 py-6 sm:px-20" aria-label="Welcome, slide 1 of 4">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#F5C518] uppercase">Volunteer opportunity</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
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
                    <div key={label} className="rounded-xl border border-white/20 bg-white/10 px-3 py-3">
                      <dt className="text-[11px] text-white/70">{label}</dt>
                      <dd className="mt-1 text-lg font-semibold text-[#F5C518]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="h-full w-full shrink-0 overflow-y-auto px-16 py-6 sm:px-20" aria-label="About the opportunity, slide 2 of 4">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#F5C518] uppercase">About the opportunity</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Be part of a historic public health gathering</h2>
                <p className="mt-3 max-w-3xl leading-7 text-white/85">
                  The 5th International Conference on Public Health in Africa (CPHIA 2026) convenes under the theme “Africa’s Health Security and Sovereignty.” Volunteers help deliver a world-class experience in Addis Ababa.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {reasons.map((reason) => {
                    const Icon = reason.icon;
                    return (
                      <article key={reason.title} className="rounded-2xl border border-white/20 bg-white/10 p-4">
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

              <section className="h-full w-full shrink-0 overflow-y-auto px-16 py-6 sm:px-20" aria-label="Roles and eligibility, slide 3 of 4">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Roles and eligibility</h2>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
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
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
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

              <section className="flex h-full w-full shrink-0 flex-col items-center justify-center overflow-y-auto px-16 py-6 text-center sm:px-20" aria-label="Start your application, slide 4 of 4">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#F5C518] uppercase">CPHIA 2026 volunteers</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Ready to represent Ethiopia and the continent?</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                  This is the last slide. Continue to registration for the CPHIA-26 volunteer cohort.
                </p>
                <button
                  type="button"
                  onClick={goToRegister}
                  className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-[#F5C518] px-5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#e6b70f]"
                >
                  Start your application
                  <ArrowRight className="size-4" />
                </button>
              </section>
            </div>
          </div>

          <button
            type="button"
            aria-label="Previous slide"
            onClick={goBack}
            disabled={index === 0}
            className="absolute top-1/2 left-2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-[#041816]/70 text-white shadow-lg backdrop-blur-md hover:bg-[#041816] disabled:cursor-not-allowed disabled:opacity-30 sm:left-3"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={goNext}
            disabled={last}
            className="absolute top-1/2 right-2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-[#F5C518] text-[#1a1a1a] shadow-lg hover:bg-[#e6b70f] disabled:cursor-not-allowed disabled:opacity-30 sm:right-3"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>

        <div className="mt-3 flex shrink-0 items-center justify-center gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]" aria-label="Slide progress">
          {Array.from({ length: SLIDE_COUNT }, (_, dot) => (
            <button
              key={dot}
              type="button"
              aria-label={`Go to slide ${dot + 1}`}
              aria-current={dot === index ? 'true' : undefined}
              onClick={() => {
                setPaused(true);
                setIndex(dot);
              }}
              className={`h-2.5 rounded-full transition-all ${dot === index ? 'w-8 bg-[#F5C518]' : 'w-2.5 bg-white/45 hover:bg-white/70'}`}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
