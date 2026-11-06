'use client';

import { useRef } from 'react';
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
  variant,
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

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <PhotoUpload
        photoUrl={photoUrl}
        photoName={photo?.fileName}
        sizeLabel={photo ? `${Math.round(photo.size / 1024)} KB` : undefined}
        required={required}
        variant={variant}
        onTake={() => takeRef.current?.click()}
        onChoose={() => chooseRef.current?.click()}
        onRemove={onRemove}
      />
      <input ref={takeRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" capture={capture} onChange={(event) => onUpload(event.target.files?.[0] ?? null)} />
      <input ref={chooseRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onUpload(event.target.files?.[0] ?? null)} />
    </Field>
  );
}
