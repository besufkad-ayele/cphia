'use client';

import { useRef } from 'react';
import { Field, PhotoUpload } from './ui';
import type { StoredPhoto } from '../types';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const DOCUMENT_ACCEPT = `${IMAGE_ACCEPT},application/pdf`;

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

  return (
    <Field id={id} label={label} hint={hint ?? (allowPdf ? 'JPG, PNG, WEBP, or PDF' : 'JPG, PNG, or WEBP')} error={error}>
      <PhotoUpload
        photoUrl={photoUrl}
        photoName={photo?.fileName}
        fileType={photo?.type}
        sizeLabel={photo ? `${Math.round(photo.size / 1024)} KB` : undefined}
        required={required}
        variant={variant}
        onTake={() => takeRef.current?.click()}
        onChoose={() => chooseRef.current?.click()}
        onRemove={onRemove}
      />
      <input ref={takeRef} className="hidden" type="file" accept={IMAGE_ACCEPT} capture={capture} onChange={(event) => onUpload(event.target.files?.[0] ?? null)} />
      <input ref={chooseRef} className="hidden" type="file" accept={allowPdf ? DOCUMENT_ACCEPT : IMAGE_ACCEPT} onChange={(event) => onUpload(event.target.files?.[0] ?? null)} />
    </Field>
  );
}
