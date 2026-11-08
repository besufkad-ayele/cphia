'use client';

export const BRAND_TRANSITION_EVENT = 'cphia:brand-transition';
export const BRAND_TRANSITION_MIN_MS = 3000;

type BrandTransitionDetail = {
  minMs?: number;
  label?: string;
};

/** Show the forced brand loader overlay (min ~3s). */
export function requestBrandTransition(detail: BrandTransitionDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BRAND_TRANSITION_EVENT, {
      detail: {
        minMs: detail.minMs ?? BRAND_TRANSITION_MIN_MS,
        label: detail.label ?? 'Loading',
      },
    }),
  );
}

const PUBLIC_FIRST_KEY = 'cphia.brand.public-first-nav';

/** First public page-to-page transition in this tab (e.g. home → register). */
export function consumePublicFirstTransition() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(PUBLIC_FIRST_KEY) === '1') return false;
    window.sessionStorage.setItem(PUBLIC_FIRST_KEY, '1');
    return true;
  } catch {
    return true;
  }
}
