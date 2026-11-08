import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import {
  ATTENDANCE_EXPORT_COLUMNS,
  DEFAULT_ATTENDANCE_EXPORT_COLUMNS,
  type AttendanceExportColumnId,
} from '@/app/lib/admin/attendance-columns';
import { cellForAttendanceExport, loadAttendanceRows } from '@/app/lib/admin/attendance-query';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { isAttendanceStatus, sanitizeSearch } from '@/app/lib/admin/ops';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const allowed = new Set<string>(ATTENDANCE_EXPORT_COLUMNS.map((column) => column.id));
const labels = new Map(ATTENDANCE_EXPORT_COLUMNS.map((column) => [column.id, column.label]));

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'attendance.verify');
  if (!gate.ok) return gate.error;

  const params = request.nextUrl.searchParams;
  const columns = (params.get('columns') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is AttendanceExportColumnId => allowed.has(item));
  const selected = columns.length ? columns : DEFAULT_ATTENDANCE_EXPORT_COLUMNS;
  const format = params.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const statusRaw = params.get('status') || '';
  const status = isAttendanceStatus(statusRaw) ? statusRaw : '';
  // Block/shift exports include pending (open/submitted) marks by default.
  const verifiedOnly = params.get('verifiedOnly') === '1';

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    const rows = await loadAttendanceRows(supabase, {
      fromDate: params.get('from') || undefined,
      toDate: params.get('to') || undefined,
      cohortId: params.get('cohortId') || undefined,
      teamId: params.get('teamId') || undefined,
      status: status || undefined,
      kind: params.get('kind') || undefined,
      search: sanitizeSearch(params.get('q') || '') || undefined,
      blockId: params.get('blockId') || undefined,
      shiftId: params.get('shiftId') || undefined,
      verifiedOnly,
      scopedTeamIds,
    });

    const mapped = rows.map((row) => {
      const out: Record<string, string> = {};
      for (const column of selected) {
        out[column] = cellForAttendanceExport(row, column);
      }
      return out;
    });

    await logActivity({
      actor: gate.session,
      action: 'attendance.export',
      summary: `${gate.session.fullName} exported ${mapped.length} attendance rows`,
      entityType: 'attendance',
      metadata: {
        count: mapped.length,
        format,
        columns: selected,
        status: status || 'all',
        blockId: params.get('blockId') || null,
        shiftId: params.get('shiftId') || null,
        verifiedOnly,
      },
      request,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const scope = params.get('blockId') ? 'block' : params.get('shiftId') ? 'shift' : 'attendance';
    if (format === 'csv') {
      const header = selected.map((column) => csvCell(labels.get(column) || column)).join(',');
      const body = mapped
        .map((row) => selected.map((column) => csvCell(row[column] ?? '')).join(','))
        .join('\n');
      return new NextResponse(`${header}\n${body}\n`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${scope}-${stamp}.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');
    sheet.addRow(selected.map((column) => labels.get(column) || column));
    for (const row of mapped) {
      sheet.addRow(selected.map((column) => row[column] ?? ''));
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${scope}-${stamp}.xlsx"`,
      },
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
