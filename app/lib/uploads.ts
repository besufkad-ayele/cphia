/** Max upload size before reject — generous for phone camera photos. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '20 MB';

/**
 * Include extensions — some Android pickers ignore MIME-only accept lists.
 * HEIC/HEIF are listed so iPhone gallery can select them; client converts to JPEG.
 */
export const IMAGE_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
/** Broad accept list — long MIME lists break PDF picking on some Android/iOS browsers. */
export const DOCUMENT_ACCEPT =
  'image/*,application/pdf,application/x-pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const PDF_MIMES = new Set(['application/pdf', 'application/x-pdf']);
const HEIC_MIMES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const LOOSE_BINARY = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function isJpg(signature: string) {
  return signature.startsWith('ffd8ff');
}

function isPng(signature: string) {
  return signature.startsWith('89504e470d0a1a0a');
}

function isWebp(signature: string) {
  return signature.startsWith('52494646') && signature.slice(16, 24).toLowerCase() === '57454250';
}

/** PDF header may sit after whitespace/BOM — scan the first 8KB. */
export function isPdfBytes(bytes: Uint8Array) {
  const limit = Math.min(bytes.length, 8192);
  for (let i = 0; i <= limit - 4; i += 1) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) {
      return true;
    }
  }
  return false;
}

function fileSignature(bytes: Uint8Array) {
  return Array.from(bytes.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function looksLikeImage(bytes: Uint8Array) {
  const signature = fileSignature(bytes);
  return isJpg(signature) || isPng(signature) || isWebp(signature);
}

function mimeFromImageBytes(bytes: Uint8Array) {
  const signature = fileSignature(bytes);
  if (isJpg(signature)) return 'image/jpeg';
  if (isPng(signature)) return 'image/png';
  if (isWebp(signature)) return 'image/webp';
  return null;
}

export function extensionForMime(mimeType: string) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export function isPdfFileName(name?: string | null) {
  return Boolean(name && /\.pdf$/i.test(name));
}

/** iPhone gallery photos are often HEIC — convert client-side before upload. */
export function isLikelyHeic(file: { name?: string; type?: string }, bytes?: Uint8Array) {
  // Never treat PDFs as HEIC (filename or magic bytes).
  if (isPdfFileName(file.name) || (bytes && isPdfBytes(bytes))) return false;
  const type = (file.type || '').toLowerCase().trim();
  if (PDF_MIMES.has(type)) return false;
  if (HEIC_MIMES.has(type)) return true;
  if (/\.(heic|heif)$/i.test(file.name || '')) return true;
  if (!bytes || bytes.length < 12) return false;
  // ISO BMFF: ....ftyp + brand heic/heif/mif1/msf1
  const brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (brand !== 'ftyp') return false;
  const major = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
  return major === 'heic' || major === 'heif' || major === 'mif1' || major === 'msf1';
}

export const HEIC_UPLOAD_MESSAGE =
  'Could not convert this iPhone HEIC photo. Try Take photo, or set iPhone Camera → Formats → Most Compatible.';

export function isPdfUrl(url?: string | null) {
  if (!url) return false;
  try {
    const path = new URL(url, 'https://local.invalid').pathname;
    return /\.pdf$/i.test(path);
  } catch {
    return /\.pdf($|\?)/i.test(url);
  }
}

export type UploadInspectResult =
  | { mime: string; extension: string }
  | { error: 'INVALID_PHOTO' | 'HEIC_UNSUPPORTED' };

/**
 * Resolve a real content type from browser MIME (often empty on mobile),
 * filename, and magic bytes. Phones frequently send PDFs as "" or octet-stream.
 * Callers that accept HEIC should convert first via prepareUploadFile.
 */
export function resolveUploadMime(
  file: { name?: string; type?: string },
  bytes: Uint8Array,
  options?: { imagesOnly?: boolean },
): UploadInspectResult {
  const declared = (file.type || '').toLowerCase().trim();
  const name = file.name || '';
  const imageMime = mimeFromImageBytes(bytes);
  const pdfBytes = isPdfBytes(bytes);
  const pdfName = isPdfFileName(name);
  const declaredPdf = PDF_MIMES.has(declared);
  const declaredImage = IMAGE_MIMES.has(declared);
  const looseType = LOOSE_BINARY.has(declared);

  if (options?.imagesOnly) {
    if (isLikelyHeic(file, bytes)) return { error: 'HEIC_UNSUPPORTED' };
    if (imageMime) return { mime: imageMime, extension: extensionForMime(imageMime) };
    return { error: 'INVALID_PHOTO' };
  }

  // PDF first — phones often send empty/octet-stream types for Files app PDFs.
  if (pdfBytes || declaredPdf || pdfName) {
    return { mime: 'application/pdf', extension: 'pdf' };
  }

  if (isLikelyHeic(file, bytes)) return { error: 'HEIC_UNSUPPORTED' };

  // Prefer magic bytes — most reliable across phones/browsers.
  if (imageMime) return { mime: imageMime, extension: extensionForMime(imageMime) };

  if (declaredImage && looksLikeImage(bytes)) {
    const mime = declared === 'image/jpg' ? 'image/jpeg' : declared;
    return { mime, extension: extensionForMime(mime) };
  }

  // Last resort: loose binary with no name still fails.
  if (looseType && looksLikeImage(bytes)) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }

  return { error: 'INVALID_PHOTO' };
}

/** Client-side pre-check before upload (reads a small header only). */
export async function inspectUploadFile(
  file: File,
  options?: { imagesOnly?: boolean },
): Promise<UploadInspectResult> {
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  return resolveUploadMime(file, head, options);
}

export function uploadRejectMessage(
  error: 'INVALID_PHOTO' | 'HEIC_UNSUPPORTED' | 'PHOTO_TOO_LARGE' | 'PROCESS_FAILED',
  options?: { imagesOnly?: boolean },
) {
  if (error === 'HEIC_UNSUPPORTED') return HEIC_UPLOAD_MESSAGE;
  if (error === 'PHOTO_TOO_LARGE') return `File is too large. Maximum allowed is ${MAX_UPLOAD_LABEL}.`;
  if (error === 'PROCESS_FAILED') return 'File could not be processed. Please try another photo or PDF.';
  return options?.imagesOnly
    ? 'File must be a JPG, PNG, or WEBP image.'
    : 'File must be a supported image or PDF.';
}
