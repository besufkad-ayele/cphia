import { getSupabaseAdmin } from '@/app/lib/supabase/server';
import { MAX_UPLOAD_BYTES } from '@/app/lib/uploads';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const portraitMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isJpg(signature: string) {
  return signature.startsWith('ffd8ff');
}

function isPng(signature: string) {
  return signature.startsWith('89504e470d0a1a0a');
}

function isWebp(signature: string) {
  return signature.startsWith('52494646') && signature.slice(16, 24).toLowerCase() === '57454250';
}

function isPdf(signature: string) {
  return signature.startsWith('25504446');
}

function fileSignature(bytes: Uint8Array) {
  return Array.from(bytes.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function looksLikeImage(bytes: Uint8Array) {
  const signature = fileSignature(bytes);
  return isJpg(signature) || isPng(signature) || isWebp(signature);
}

function looksLikeAllowedFile(bytes: Uint8Array, mimeType: string) {
  const signature = fileSignature(bytes);
  if (mimeType === 'application/pdf') return isPdf(signature);
  return looksLikeImage(bytes);
}

export function extensionForMime(mimeType: string) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadVolunteerPhoto(
  file: File,
  objectPath: string,
  options?: { imagesOnly?: boolean },
) {
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'PHOTO_TOO_LARGE' as const };
  const allowed = options?.imagesOnly ? portraitMimeTypes : allowedMimeTypes;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!allowed.has(file.type) || !looksLikeAllowedFile(bytes, file.type)) {
    return { error: 'INVALID_PHOTO' as const };
  }
  if (options?.imagesOnly && !looksLikeImage(bytes)) {
    return { error: 'INVALID_PHOTO' as const };
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from('volunteer-photos').upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    console.error('volunteer_photo_upload_error', error);
    return { error: 'UPLOAD_FAILED' as const };
  }
  return { path: objectPath };
}
