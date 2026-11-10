'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PinBelowHeaderProps = {
  children: ReactNode;
  className?: string;
  /** Marks this pin so other pins can stack underneath it. */
  pinId?: string;
  /** Stack below another pin when that one is fixed. */
  stackBelowPinId?: string;
  /** Extra gap under the header / stacked pin. */
  gap?: number;
};

function headerBottom() {
  const header = document.querySelector('.admin-dark header.sticky') as HTMLElement | null;
  return header?.getBoundingClientRect().bottom || 56;
}

function stackedTop(stackBelowPinId: string | undefined, gap: number) {
  let top = headerBottom() + gap;
  if (!stackBelowPinId) return top;
  const other = document.querySelector(
    `[data-admin-pin="${stackBelowPinId}"][data-pinned="true"]`,
  ) as HTMLElement | null;
  if (other) {
    top = Math.max(top, other.getBoundingClientRect().bottom + gap);
  }
  return top;
}

/** Pins under the admin header when body overflow breaks CSS sticky. */
export function PinBelowHeader({
  children,
  className,
  pinId,
  stackBelowPinId,
  gap = 0,
}: PinBelowHeaderProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [box, setBox] = useState({ left: 0, width: 0, height: 0, top: 56 });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const bar = barRef.current;
    if (!anchor || !bar) return;

    function sync() {
      const nextAnchor = anchorRef.current;
      const nextBar = barRef.current;
      if (!nextAnchor || !nextBar) return;
      const top = stackedTop(stackBelowPinId, gap);
      const rect = nextAnchor.getBoundingClientRect();
      const height = nextBar.offsetHeight;
      const shouldPin = rect.top <= top;
      setPinned(shouldPin);
      setBox({
        left: rect.left,
        width: rect.width,
        height,
        top,
      });
    }

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(anchor);
    ro.observe(bar);
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [gap, stackBelowPinId]);

  const barStyle: CSSProperties | undefined = pinned
    ? {
        position: 'fixed',
        top: box.top,
        left: box.left,
        width: box.width,
        zIndex: 40,
      }
    : undefined;

  return (
    <div ref={anchorRef} style={pinned ? { height: box.height } : undefined}>
      <div
        ref={barRef}
        data-admin-pin={pinId}
        data-pinned={pinned ? 'true' : 'false'}
        style={barStyle}
        className={cn(className)}
      >
        {children}
      </div>
    </div>
  );
}
