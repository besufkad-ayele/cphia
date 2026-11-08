'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const ANIMATION_SRC = '/animation/cphia-animation.json';
const LOTTIE_SCRIPT = '/vendor/lottie.min.js';

type LottieAnimation = {
  destroy: () => void;
  resize: () => void;
  play: () => void;
  addEventListener: (name: string, callback: () => void) => void;
  removeEventListener: (name: string, callback: () => void) => void;
};

type LottiePlayer = {
  loadAnimation: (params: {
    container: Element;
    renderer: 'svg' | 'canvas' | 'html';
    loop: boolean;
    autoplay: boolean;
    path?: string;
    animationData?: unknown;
    rendererSettings?: { preserveAspectRatio?: string; progressiveLoad?: boolean };
  }) => LottieAnimation;
};

declare global {
  interface Window {
    lottie?: LottiePlayer;
  }
}

let scriptPromise: Promise<LottiePlayer> | null = null;
let animationDataPromise: Promise<unknown> | null = null;

function loadLottieLibrary(): Promise<LottiePlayer> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Lottie only runs in the browser.'));
  }
  if (window.lottie) return Promise.resolve(window.lottie);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LOTTIE_SCRIPT}"]`);
    if (existing) {
      const finish = () => {
        if (window.lottie) resolve(window.lottie);
        else reject(new Error('Lottie failed to load.'));
      };
      if (window.lottie) {
        finish();
        return;
      }
      existing.addEventListener('load', finish);
      existing.addEventListener('error', () => reject(new Error('Could not load Lottie script.')));
      return;
    }
    const script = document.createElement('script');
    script.src = LOTTIE_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.lottie) resolve(window.lottie);
      else reject(new Error('Lottie failed to load.'));
    };
    script.onerror = () => reject(new Error('Could not load Lottie script.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function loadAnimationData() {
  if (!animationDataPromise) {
    animationDataPromise = fetch(ANIMATION_SRC)
      .then((response) => {
        if (!response.ok) throw new Error('Animation JSON missing.');
        return response.json();
      })
      .catch((error) => {
        animationDataPromise = null;
        throw error;
      });
  }
  return animationDataPromise;
}

type CphiaLoaderProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  fullscreen?: boolean;
};

const SIZE = {
  sm: 'size-16',
  md: 'size-28',
  lg: 'size-44',
  xl: 'size-72 sm:size-80',
} as const;

function FallbackMark({ className }: { className?: string }) {
  return (
    <div className={cn('relative grid place-items-center', className)}>
      <Image
        src="/cphia-africa-logo.png"
        alt=""
        width={160}
        height={160}
        className="size-full animate-spin object-contain [animation-duration:3.2s]"
        priority
      />
    </div>
  );
}

export function CphiaLoader({
  className,
  size = 'md',
  label = 'Loading',
  fullscreen = false,
}: CphiaLoaderProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE[size];

  useEffect(() => {
    let cancelled = false;
    let animation: LottieAnimation | null = null;
    let onDomLoaded: (() => void) | null = null;

    Promise.all([loadLottieLibrary(), loadAnimationData()])
      .then(([lottie, animationData]) => {
        if (cancelled || !hostRef.current) return;
        // Keep the host visible (never display:none) so Lottie can measure size.
        hostRef.current.innerHTML = '';
        animation = lottie.loadAnimation({
          container: hostRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            progressiveLoad: true,
          },
        });
        onDomLoaded = () => {
          if (cancelled) return;
          animation?.resize();
          animation?.play();
          setReady(true);
        };
        animation.addEventListener('DOMLoaded', onDomLoaded);
        // Some builds fire before the listener attaches — force a resize tick.
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          animation?.resize();
          if (hostRef.current?.querySelector('svg')) {
            setReady(true);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (animation && onDomLoaded) {
        try {
          animation.removeEventListener('DOMLoaded', onDomLoaded);
        } catch {
          /* ignore */
        }
      }
      animation?.destroy();
    };
  }, []);

  const body = (
    <div
      className={cn('relative grid place-items-center', sizeClass, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {!ready || failed ? (
        <FallbackMark className="absolute inset-0" />
      ) : null}
      <div
        ref={hostRef}
        className={cn(
          'relative size-full overflow-hidden [&_svg]:block [&_svg]:h-full [&_svg]:w-full',
          (!ready || failed) && 'opacity-0',
        )}
      />
    </div>
  );

  if (!fullscreen) return body;

  return (
    <div className="grid min-h-[60vh] w-full place-items-center bg-transparent p-6">
      {body}
    </div>
  );
}

export function CphiaLoaderInline({ className }: { className?: string }) {
  return <CphiaLoader size="sm" className={className} label="Loading" />;
}

/** Prefetch Lottie + JSON so the first brand gate shows the real animation. */
export function prefetchCphiaAnimation() {
  if (typeof window === 'undefined') return;
  void loadLottieLibrary().catch(() => null);
  void loadAnimationData().catch(() => null);
}
