import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { logActivity } from '@/app/lib/admin/activity';
import { requireFeature } from '@/app/lib/admin/guard';
import { ASSET_SLOTS } from '@/app/lib/admin/types';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function extensionFromPath(path: string) {
  const match = path.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match?.[1]?.toLowerCase() || 'bin';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;
  if (gate.session.role !== 'super_admin') {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'Only super admins can download volunteer assets.' }, { status: 403 });
  }

  const { id } = await context.params;
  const slot = request.nextUrl.searchParams.get('slot');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('registrations')
    .select('id, registration_id, photo_path, fan_photo_path, fan_photo_back_path, second_id_photo_path, bank_owner_id_photo_path, ureport_screenshot_path')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('admin_assets_lookup_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const record = data as Record<string, string | null>;
  const registrationId = record.registration_id || id;
  const slots = slot
    ? ASSET_SLOTS.filter((item) => item.key === slot)
    : ASSET_SLOTS;

  if (!slots.length) {
    return NextResponse.json({ error: 'INVALID_SLOT' }, { status: 400 });
  }

  // Single file download
  if (slot && slots.length === 1) {
    const item = slots[0]!;
    const path = record[item.pathKey];
    if (!path) return NextResponse.json({ error: 'NOT_FOUND', message: 'That file is not on this registration.' }, { status: 404 });
    const downloaded = await supabase.storage.from('volunteer-photos').download(path);
    if (downloaded.error || !downloaded.data) {
      return NextResponse.json({ error: 'DOWNLOAD_FAILED' }, { status: 502 });
    }
    const bytes = await downloaded.data.arrayBuffer();
    const filename = `${registrationId}-${item.label}.${extensionFromPath(path)}`;
    await logActivity({
      actor: gate.session,
      action: 'export.volunteer_asset',
      summary: `${gate.session.fullName} downloaded ${item.label} for ${registrationId}`,
      entityType: 'registration',
      entityId: id,
      metadata: { slot: item.key, path },
      request,
    });
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': downloaded.data.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const zip = new JSZip();
  let added = 0;
  for (const item of slots) {
    const path = record[item.pathKey];
    if (!path) continue;
    const downloaded = await supabase.storage.from('volunteer-photos').download(path);
    if (downloaded.error || !downloaded.data) continue;
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    zip.file(`${registrationId}-${item.label}.${extensionFromPath(path)}`, bytes);
    added += 1;
  }

  if (!added) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'No files are attached to this volunteer.' }, { status: 404 });
  }

  const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  await logActivity({
    actor: gate.session,
    action: 'export.volunteer_assets',
    summary: `${gate.session.fullName} downloaded ${added} asset file${added === 1 ? '' : 's'} for ${registrationId}`,
    entityType: 'registration',
    entityId: id,
    metadata: { count: added },
    request,
  });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${registrationId}-assets.zip"`,
    },
  });
}
