'use client';

import { useRef } from 'react';
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, MAX_UPLOAD_LABEL } from '@/app/lib/uploads';
import { Field, PhotoUpload } from './ui';
import type { StoredPhoto } from '../types';

export function ImageField({
  id,
  label,
  hint,
  error,
  photo,
  photoUrl,
  required,
  variant = 'portrait',
  capture = 'environment',
  onUpload,
  onRemove,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  photo: StoredPhoto | null;
  photoUrl: string | null;
  required?: boolean;
  variant?: 'portrait' | 'document';
  capture?: 'user' | 'environment';
  onUpload: (file: File | null) => void;
  onRemove: () => void;
}) {
  const takeRef = useRef<HTMLInputElement | null>(null);
  const chooseRef = useRef<HTMLInputElement | null>(null);
  const allowPdf = variant === 'document';
  const formatHint = allowPdf
    ? `JPG, PNG, WEBP, HEIC, or PDF · max ${MAX_UPLOAD_LABEL}`
    : `JPG, PNG, WEBP, or HEIC · max ${MAX_UPLOAD_LABEL}`;
  const sizeLabel = photo
    ? `${Math.round(photo.size / 1024)} KB · max ${MAX_UPLOAD_LABEL}`
    : `Max ${MAX_UPLOAD_LABEL}`;

  function pick(file: File | null, input: HTMLInputElement | null) {
    onUpload(file);
    // Allow re-selecting the same PDF/file on mobile.
    if (input) input.value = '';
  }

  return (
    <Field id={id} label={label} hint={hint ? `${hint} ${formatHint}` : formatHint} error={error}>
      <PhotoUpload
        photoUrl={photoUrl}
        photoName={photo?.fileName}
        fileType={photo?.type}
        sizeLabel={sizeLabel}
        required={required}
        variant={variant}
        onTake={() => takeRef.current?.click()}
        onChoose={() => chooseRef.current?.click()}
        onRemove={onRemove}
      />
      <input
        ref={takeRef}
        className="hidden"
        type="file"
        accept={IMAGE_ACCEPT}
        capture={capture}
        onChange={(event) => pick(event.target.files?.[0] ?? null, event.target)}
      />
      <input
        ref={chooseRef}
        className="hidden"
        type="file"
        accept={allowPdf ? DOCUMENT_ACCEPT : IMAGE_ACCEPT}
        onChange={(event) => pick(event.target.files?.[0] ?? null, event.target)}
      />
    </Field>
  );
}
