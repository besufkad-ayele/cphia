'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BRAND_TRANSITION_EVENT,
  BRAND_TRANSITION_MIN_MS,
} from '@/app/lib/brand-transition';
import { CphiaLoader, prefetchCphiaAnimation } from '@/components/brand/cphia-loader';

type Pending = {
  minMs: number;
  label: string;
};

/**
 * Full-screen brand animation gate. Call `requestBrandTransition()` before/during
 * navigations that must hold for at least 3 seconds.
 */
export function BrandTransitionGate() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    prefetchCphiaAnimation();

    function onRequest(event: Event) {
      const custom = event as CustomEvent<{ minMs?: number; label?: string }>;
      const minMs = Math.max(BRAND_TRANSITION_MIN_MS, Number(custom.detail?.minMs) || BRAND_TRANSITION_MIN_MS);
      const label = custom.detail?.label || 'Loading';
      setPending({ minMs, label });
      setVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        // Keep the loader mounted briefly so exit doesn't flash empty.
        window.setTimeout(() => setPending(null), 220);
        timerRef.current = null;
      }, minMs);
    }

    window.addEventListener(BRAND_TRANSITION_EVENT, onRequest);
    return () => {
      window.removeEventListener(BRAND_TRANSITION_EVENT, onRequest);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!pending) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] grid place-items-center bg-[#041816] transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="assertive"
      aria-label={pending.label}
    >
      <div className="grid place-items-center gap-4 px-6">
        <CphiaLoader size="xl" label={pending.label} />
        <p className="text-sm font-medium tracking-wide text-white/80">{pending.label}</p>
      </div>
    </div>
  );
}
