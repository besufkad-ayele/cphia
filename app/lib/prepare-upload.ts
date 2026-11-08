'use client';

import {
  HEIC_UPLOAD_MESSAGE,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  isLikelyHeic,
  isPdfBytes,
  isPdfFileName,
  resolveUploadMime,
  type UploadInspectResult,
} from '@/app/lib/uploads';

export type PreparedUpload =
  | {
      file: File;
      mime: string;
      extension: string;
      convertedFromHeic: boolean;
    }
  | {
      error: 'PHOTO_TOO_LARGE' | 'INVALID_PHOTO' | 'HEIC_UNSUPPORTED' | 'PROCESS_FAILED';
      message: string;
    };

function jpegNameFrom(name: string) {
  const base = name.replace(/\.(heic|heif|jpg|jpeg|png|webp)$/i, '').trim() || 'photo';
  return `${base}.jpg`;
}

/** Prefer Safari/native decode when the browser can already open HEIC. */
async function convertHeicViaCanvas(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), 'image/jpeg', 0.92);
    });
    if (!blob) return null;
    return new File([blob], jpegNameFrom(file.name), { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return null;
  }
}

async function convertHeicViaLibrary(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob) throw new Error('HEIC_EMPTY');
  return new File([blob], jpegNameFrom(file.name), { type: 'image/jpeg', lastModified: Date.now() });
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const native = await convertHeicViaCanvas(file);
  if (native) return native;
  return convertHeicViaLibrary(file);
}

async function compressImage(file: File) {
  const { default: imageCompression } = await import('browser-image-compression');
  return imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1200,
    initialQuality: 0.8,
    useWebWorker: true,
  });
}

/**
 * Normalize a picked file for upload across devices:
 * HEIC → JPEG, sniff MIME from bytes, optional compression for images.
 */
export async function prepareUploadFile(
  file: File,
  options?: { imagesOnly?: boolean; compress?: boolean },
): Promise<PreparedUpload> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: 'PHOTO_TOO_LARGE',
      message: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is ${MAX_UPLOAD_LABEL}.`,
    };
  }

  let working = file;
  let convertedFromHeic = false;

  try {
    const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
    const looksPdf =
      !options?.imagesOnly
      && (isPdfFileName(file.name) || /pdf/i.test(file.type || '') || isPdfBytes(head));

    // Short-circuit PDFs before any image/HEIC conversion path.
    if (looksPdf) {
      const named = isPdfFileName(file.name)
        ? (file.type === 'application/pdf'
          ? file
          : new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified }))
        : new File([file], `${(file.name || 'document').replace(/\.[^.]+$/, '') || 'document'}.pdf`, {
            type: 'application/pdf',
            lastModified: file.lastModified,
          });
      return {
        file: named,
        mime: 'application/pdf',
        extension: 'pdf',
        convertedFromHeic: false,
      };
    }

    if (isLikelyHeic(file, head)) {
      try {
        working = await convertHeicToJpeg(file);
        convertedFromHeic = true;
      } catch {
        return { error: 'HEIC_UNSUPPORTED', message: HEIC_UPLOAD_MESSAGE };
      }
    }

    const bytes = new Uint8Array(await working.arrayBuffer());
    const resolved: UploadInspectResult = resolveUploadMime(working, bytes, {
      imagesOnly: options?.imagesOnly,
    });
    if ('error' in resolved) {
      if (resolved.error === 'HEIC_UNSUPPORTED') {
        return { error: 'HEIC_UNSUPPORTED', message: HEIC_UPLOAD_MESSAGE };
      }
      return {
        error: 'INVALID_PHOTO',
        message: options?.imagesOnly
          ? 'File must be a JPG, PNG, or WEBP image.'
          : 'File must be a supported image or PDF.',
      };
    }

    if (resolved.mime === 'application/pdf') {
      const named = working.name.toLowerCase().endsWith('.pdf')
        ? working
        : new File([working], `${working.name || 'document'}.pdf`, {
            type: 'application/pdf',
            lastModified: working.lastModified,
          });
      return {
        file: named,
        mime: 'application/pdf',
        extension: 'pdf',
        convertedFromHeic: false,
      };
    }

    let output = working;
    if (options?.compress !== false) {
      try {
        const compressed = await compressImage(working);
        output = new File([compressed], jpegNameFrom(compressed.name || working.name), {
          type: compressed.type || resolved.mime,
          lastModified: Date.now(),
        });
      } catch {
        // Keep the converted/original image if compression fails on an odd device.
        output = working.type
          ? working
          : new File([working], jpegNameFrom(working.name), {
              type: resolved.mime,
              lastModified: working.lastModified,
            });
      }
    } else if (!working.type) {
      output = new File([working], `${working.name.replace(/\.[^.]+$/, '')}.${resolved.extension}`, {
        type: resolved.mime,
        lastModified: working.lastModified,
      });
    }

    if (output.size > MAX_UPLOAD_BYTES) {
      return {
        error: 'PHOTO_TOO_LARGE',
        message: `Processed file is too large. Maximum allowed is ${MAX_UPLOAD_LABEL}.`,
      };
    }

    return {
      file: output,
      mime: output.type || resolved.mime,
      extension: resolved.extension,
      convertedFromHeic,
    };
  } catch {
    return {
      error: 'PROCESS_FAILED',
      message: 'File could not be processed. Please try another photo or PDF.',
    };
  }
}
