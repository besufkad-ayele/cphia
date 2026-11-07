import { getSupabaseAdmin } from '@/app/lib/supabase/server';
import { MAX_UPLOAD_BYTES, extensionForMime, resolveUploadMime } from '@/app/lib/uploads';

export { extensionForMime };

export async function uploadVolunteerPhoto(
  file: File,
  objectPath: string,
  options?: { imagesOnly?: boolean },
) {
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'PHOTO_TOO_LARGE' as const };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const resolved = resolveUploadMime(file, bytes, options);
  // API keeps a single client-facing code; HEIC is still an unsupported photo format.
  if ('error' in resolved) return { error: 'INVALID_PHOTO' as const };

  // Keep caller path when it already has the right extension; otherwise swap it.
  const path =
    objectPath.replace(/\.[^.]+$/, '') + `.${resolved.extension}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from('volunteer-photos').upload(path, bytes, {
    contentType: resolved.mime,
    upsert: true,
  });
  if (error) {
    console.error('volunteer_photo_upload_error', error);
    return { error: 'UPLOAD_FAILED' as const };
  }
  return { path, mime: resolved.mime };
}
