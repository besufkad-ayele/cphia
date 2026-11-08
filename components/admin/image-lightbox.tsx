'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ImageLightbox({
  open,
  src,
  alt,
  onClose,
}: {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      onClick={onClose}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 text-white hover:bg-white/10"
        onClick={onClose}
        aria-label="Close image"
      >
        <X className="size-5" />
      </Button>
      <img
        src={src}
        alt={alt || 'Preview'}
        className={cn(
          'max-h-[min(92vh,920px)] max-w-[min(96vw,920px)] rounded-xl object-contain shadow-2xl ring-1 ring-white/15',
        )}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
