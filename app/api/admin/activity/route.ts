import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { activityCategory } from '@/app/lib/admin/activity';
import { dbError, isMissingTable } from '@/app/lib/admin/guard';
import { registrationStatusMetrics } from '@/app/lib/admin/registration-filters';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

type ActivityRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  request_path: string;
  ip: string;
};

const MODULE_LABELS: Record<string, string> = {
  auth: 'Login / auth',
  volunteer: 'Volunteers',
  attendance: 'Attendance',
  shift: 'Shifts',
  team: 'Floor teams',
  cohort: 'Cohorts / events',
  form: 'Forms',
  user: 'Team accounts',
  role: 'Roles',
  export: 'Exports',
  registration: 'Public registration',
};

function requireSuperAdmin(session: { role: string } | null) {
  if (!session) return unauthorized();
  if (session.role !== 'super_admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  return null;
}

function hourBucket(iso: string) {
  return iso.slice(0, 13) + ':00:00.000Z';
}

function dayBucket(iso: string) {
  return iso.slice(0, 10);
}

function mapFeedItem(row: ActivityRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name || 'System',
    action: row.action,
    category: activityCategory(row.action),
    module: MODULE_LABELS[activityCategory(row.action)] || activityCategory(row.action),
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    metadata: row.metadata ?? {},
    requestPath: row.request_path,
    ip: row.ip,
  };
}

function isLogin(action: string) {
  return action === 'auth.login';
}

function isModuleChange(action: string) {
  if (!action || action.startsWith('auth.')) return false;
  return true;
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  const blocked = requireSuperAdmin(session);
  if (blocked) return blocked;

  const limit = Math.min(200, Math.max(20, Number(request.nextUrl.searchParams.get('limit')) || 80));
  const since = request.nextUrl.searchParams.get('since');

  try {
    const supabase = getSupabaseAdmin();
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    let feedQuery = supabase
      .from('ops_activity_log')
      .select('id, created_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, summary, metadata, request_path, ip')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      feedQuery = feedQuery.gt('created_at', since);
    }

    const [feedResult, monthResult, registrationMetrics, sectorRows, attendanceToday, teamActive, registrationsTodayCount] = await Promise.all([
      feedQuery,
      supabase
        .from('ops_activity_log')
        .select('id, created_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, summary, metadata, request_path, ip')
        .gte('created_at', monthAgo)
        .order('created_at', { ascending: false })
        .limit(5000),
      registrationStatusMetrics(supabase, { search: '', sector: null, subsector: null }),
      supabase.from('registrations').select('sector'),
      supabase
        .from('ops_attendance')
        .select('id, status, checked_in_at, updated_at')
        .gte('updated_at', new Date().toISOString().slice(0, 10)),
      supabase.from('admins').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dayAgo),
    ]);

    if (feedResult.error && isMissingTable(feedResult.error)) {
      return NextResponse.json(
        {
          error: 'MIGRATION_REQUIRED',
          message: 'Apply supabase/migrations/011_activity_log.sql, then reload this page.',
        },
        { status: 503 },
      );
    }
    if (feedResult.error) return dbError(feedResult.error);
    if (monthResult.error && !isMissingTable(monthResult.error)) return dbError(monthResult.error);

    const feed = (feedResult.data ?? []) as ActivityRow[];
    const monthRows = (monthResult.data ?? []) as ActivityRow[];
    const dayRows = monthRows.filter((row) => row.created_at >= dayAgo);
    const weekRows = monthRows.filter((row) => row.created_at >= weekAgo);

    const byAction = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byActor = new Map<string, { name: string; email: string; count: number }>();
    const byHour = new Map<string, number>();

    for (let i = 23; i >= 0; i -= 1) {
      const bucket = hourBucket(new Date(now - i * 60 * 60 * 1000).toISOString());
      byHour.set(bucket, 0);
    }

    for (const row of dayRows) {
      byAction.set(row.action, (byAction.get(row.action) || 0) + 1);
      const category = activityCategory(row.action);
      byCategory.set(category, (byCategory.get(category) || 0) + 1);
      const actorKey = row.actor_id || row.actor_email || 'system';
      const existing = byActor.get(actorKey);
      if (existing) existing.count += 1;
      else byActor.set(actorKey, { name: row.actor_name || 'System', email: row.actor_email || '', count: 1 });
      const bucket = hourBucket(row.created_at);
      if (byHour.has(bucket)) byHour.set(bucket, (byHour.get(bucket) || 0) + 1);
    }

    const lastHour = dayRows.filter((row) => row.created_at >= hourAgo).length;
    const uniqueActorsToday = new Set(dayRows.map((row) => row.actor_id || row.actor_email).filter(Boolean)).size;

    const sectorCounts = new Map<string, number>();
    for (const row of sectorRows.data ?? []) {
      if (row.sector) sectorCounts.set(row.sector, (sectorCounts.get(row.sector) || 0) + 1);
    }

    const attendanceRows = attendanceToday.data ?? [];
    const attendanceCounts = { present: 0, late: 0, absent: 0, excused: 0, total: attendanceRows.length };
    for (const row of attendanceRows) {
      if (row.status === 'present') attendanceCounts.present += 1;
      else if (row.status === 'late') attendanceCounts.late += 1;
      else if (row.status === 'absent') attendanceCounts.absent += 1;
      else if (row.status === 'excused') attendanceCounts.excused += 1;
    }

    const monthLogins = monthRows.filter((row) => isLogin(row.action));
    const monthChanges = monthRows.filter((row) => isModuleChange(row.action));

    const loginByActor = new Map<string, { name: string; email: string; count: number; lastAt: string }>();
    for (const row of monthLogins) {
      const key = row.actor_id || row.actor_email || 'unknown';
      const existing = loginByActor.get(key);
      if (existing) {
        existing.count += 1;
        if (row.created_at > existing.lastAt) existing.lastAt = row.created_at;
      } else {
        loginByActor.set(key, {
          name: row.actor_name || 'Unknown',
          email: row.actor_email || '',
          count: 1,
          lastAt: row.created_at,
        });
      }
    }

    type ModuleActor = { name: string; email: string; count: number; lastAt: string };
    const moduleMap = new Map<string, { module: string; label: string; count: number; actors: Map<string, ModuleActor> }>();
    const actorModuleMap = new Map<string, { name: string; email: string; total: number; modules: Map<string, number> }>();

    for (const row of monthChanges) {
      const category = activityCategory(row.action);
      const label = MODULE_LABELS[category] || category;
      const actorKey = row.actor_id || row.actor_email || 'system';
      const actorName = row.actor_name || 'System';
      const actorEmail = row.actor_email || '';

      let moduleEntry = moduleMap.get(category);
      if (!moduleEntry) {
        moduleEntry = { module: category, label, count: 0, actors: new Map() };
        moduleMap.set(category, moduleEntry);
      }
      moduleEntry.count += 1;
      const actorOnModule = moduleEntry.actors.get(actorKey);
      if (actorOnModule) {
        actorOnModule.count += 1;
        if (row.created_at > actorOnModule.lastAt) actorOnModule.lastAt = row.created_at;
      } else {
        moduleEntry.actors.set(actorKey, { name: actorName, email: actorEmail, count: 1, lastAt: row.created_at });
      }

      let person = actorModuleMap.get(actorKey);
      if (!person) {
        person = { name: actorName, email: actorEmail, total: 0, modules: new Map() };
        actorModuleMap.set(actorKey, person);
      }
      person.total += 1;
      person.modules.set(label, (person.modules.get(label) || 0) + 1);
    }

    const byDay = new Map<string, { day: string; logins: number; changes: number }>();
    for (let i = 29; i >= 0; i -= 1) {
      const day = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      byDay.set(day, { day, logins: 0, changes: 0 });
    }
    for (const row of monthLogins) {
      const day = dayBucket(row.created_at);
      const bucket = byDay.get(day);
      if (bucket) bucket.logins += 1;
    }
    for (const row of monthChanges) {
      const day = dayBucket(row.created_at);
      const bucket = byDay.get(day);
      if (bucket) bucket.changes += 1;
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      pollMs: 2000,
      feed: feed.map(mapFeedItem),
      stats: {
        lastHour,
        last24h: dayRows.length,
        last7d: weekRows.length,
        uniqueActorsToday,
        activeAdmins: teamActive.count ?? 0,
        registrationsToday: registrationsTodayCount.count ?? 0,
        registrations: registrationMetrics,
        attendanceToday: attendanceCounts,
      },
      charts: {
        byHour: [...byHour.entries()].map(([hour, count]) => ({ hour, count })),
        byAction: [...byAction.entries()]
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
        byCategory: [...byCategory.entries()]
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count),
        byActor: [...byActor.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        bySector: [...sectorCounts.entries()]
          .map(([sector, count]) => ({ sector, count }))
          .sort((a, b) => b.count - a.count),
      },
      month: {
        since: monthAgo,
        days: 30,
        stats: {
          logins: monthLogins.length,
          changes: monthChanges.length,
          uniqueLogins: loginByActor.size,
          uniqueEditors: actorModuleMap.size,
        },
        logins: monthLogins.slice(0, 150).map(mapFeedItem),
        loginByActor: [...loginByActor.values()]
          .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt)),
        changes: monthChanges.slice(0, 200).map(mapFeedItem),
        byModule: [...moduleMap.values()]
          .map((entry) => ({
            module: entry.module,
            label: entry.label,
            count: entry.count,
            actors: [...entry.actors.values()].sort((a, b) => b.count - a.count),
          }))
          .sort((a, b) => b.count - a.count),
        byActorModules: [...actorModuleMap.values()]
          .map((person) => ({
            name: person.name,
            email: person.email,
            total: person.total,
            modules: [...person.modules.entries()]
              .map(([module, count]) => ({ module, count }))
              .sort((a, b) => b.count - a.count),
          }))
          .sort((a, b) => b.total - a.total),
        byDay: [...byDay.values()],
      },
    });
  } catch (error) {
    console.error('admin_activity_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
