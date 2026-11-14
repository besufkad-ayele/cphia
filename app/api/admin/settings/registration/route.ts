import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, isMissingTable, requireFeature } from '@/app/lib/admin/guard';
import { canControlRegistrationGate } from '@/app/lib/admin/ops-audit-access';
import {
  getRegistrationOpen,
  registrationOpenEnvOverride,
  setRegistrationOpen,
} from '@/app/lib/registration-open';

export const runtime = 'nodejs';

function forbiddenOwner() {
  return NextResponse.json(
    {
      error: 'FORBIDDEN',
      message: 'Only the designated superadmin desk owner can open or close registration.',
    },
    { status: 403 },
  );
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;
  if (!canControlRegistrationGate(gate.session)) return forbiddenOwner();

  try {
    const open = await getRegistrationOpen();
    const envOverride = registrationOpenEnvOverride();
    return NextResponse.json({
      open,
      source: envOverride == null ? 'desk' : 'env',
      envLocked: envOverride != null,
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;
  if (!canControlRegistrationGate(gate.session)) return forbiddenOwner();

  const envOverride = registrationOpenEnvOverride();
  if (envOverride != null) {
    return NextResponse.json(
      {
        error: 'ENV_LOCKED',
        message:
          'Registration is locked by NEXT_PUBLIC_REGISTRATION_OPEN on the server. Clear that env var and redeploy to use this button.',
        open: envOverride,
        envLocked: true,
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.open !== 'boolean') {
    return NextResponse.json({ error: 'INVALID', message: 'Send { open: true | false }.' }, { status: 400 });
  }

  try {
    const result = await setRegistrationOpen({
      open: body.open,
      updatedBy: gate.session.id,
    });

    await logActivity({
      actor: gate.session,
      action: body.open ? 'registration.open' : 'registration.close',
      summary: `${gate.session.fullName} ${body.open ? 'opened' : 'closed'} public volunteer registration`,
      entityType: 'desk_settings',
      entityId: 'registration_open',
      metadata: { open: body.open },
      request,
    });

    return NextResponse.json({ ok: true, open: result.open, source: 'desk', envLocked: false });
  } catch (error) {
    if (isMissingTable(error as { message?: string })) {
      return NextResponse.json(
        {
          error: 'MIGRATION_REQUIRED',
          message: 'Apply supabase/migrations/022_desk_settings_registration.sql, then try again.',
        },
        { status: 503 },
      );
    }
    return dbError(error as { message?: string });
  }
}
