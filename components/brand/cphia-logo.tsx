import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/utils';

const FULL_SRC = '/cphia-2026-logo.png';
const MARK_SRC = '/cphia-africa-logo.png';

type CphiaLogoProps = {
  className?: string;
  /** Full wordmark or circular Africa mark. */
  variant?: 'full' | 'mark';
  /**
   * When set, the logo is a link (e.g. admin dashboard `/admin`, public home `/`).
   */
  href?: string | Route;
  priority?: boolean;
  onClick?: () => void;
  alt?: string;
};

export function CphiaLogo({
  className,
  variant = 'full',
  href,
  priority = false,
  onClick,
  alt = 'CPHIA, International Conference on Public Health in Africa',
}: CphiaLogoProps) {
  const mark = variant === 'mark';
  const image = (
    <Image
      src={mark ? MARK_SRC : FULL_SRC}
      alt={alt}
      width={mark ? 120 : 420}
      height={mark ? 120 : 140}
      priority={priority}
      className={cn(
        mark
          ? 'size-10 object-contain'
          : 'h-12 w-auto max-w-[220px] object-contain object-left sm:h-14 sm:max-w-none',
        className,
      )}
    />
  );

  if (!href) {
    return onClick ? (
      <button type="button" onClick={onClick} className="inline-flex" aria-label={alt}>
        {image}
      </button>
    ) : (
      image
    );
  }

  return (
    <Link href={href as Route} onClick={onClick} className="inline-flex" aria-label={alt}>
      {image}
    </Link>
  );
}

/** Collapsed sidebar / icon-only mark. */
export function CphiaMark({
  className,
  href = '/admin',
  priority = false,
  onClick,
}: {
  className?: string;
  href?: string;
  priority?: boolean;
  onClick?: () => void;
}) {
  return (
    <CphiaLogo
      variant="mark"
      href={href}
      priority={priority}
      onClick={onClick}
      className={cn('size-10', className)}
      alt="CPHIA dashboard"
    />
  );
}
