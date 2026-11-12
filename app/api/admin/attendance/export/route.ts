import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import {
  ATTENDANCE_EXPORT_COLUMNS,
  ATTENDANCE_PERSON_EXPORT_COLUMN_IDS,
  DEFAULT_ATTENDANCE_EXPORT_COLUMNS,
  DEFAULT_PERSON_DAY_EXPORT_COLUMNS,
  type AttendanceExportColumnId,
  type AttendancePersonColumnId,
} from '@/app/lib/admin/attendance-columns';
import {
  buildPersonAttendanceExport,
  cellForAttendanceExport,
  loadApprovedVolunteers,
  loadAttendanceRows,
  type PersonDayExportMode,
} from '@/app/lib/admin/attendance-query';
import { attendanceFiltersFromSearchParams } from '@/app/lib/admin/attendance-report-params';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const allowed = new Set<string>(ATTENDANCE_EXPORT_COLUMNS.map((column) => column.id));
const personAllowed = new Set<string>(ATTENDANCE_PERSON_EXPORT_COLUMN_IDS);
const labels = new Map(ATTENDANCE_EXPORT_COLUMNS.map((column) => [column.id, column.label]));

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function ensureSubcategoryColumns<T extends string>(columns: T[]): T[] {
  const required = ['health_subsectors', 'role_subsectors'] as const;
  const next = [...columns];
  for (const id of required) {
    if (!next.includes(id as T)) {
      const sectorAt = next.indexOf('sector' as T);
      next.splice(sectorAt >= 0 ? sectorAt + 1 : next.length, 0, id as T);
    }
  }
  return next;
}

function parsePersonColumns(raw: string | null): AttendancePersonColumnId[] {
  const columns = (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is AttendancePersonColumnId => personAllowed.has(item));
  return ensureSubcategoryColumns(columns.length ? columns : [...DEFAULT_PERSON_DAY_EXPORT_COLUMNS]);
}

export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'attendance.reports');
  if (!gate.ok) return gate.error;

  const params = request.nextUrl.searchParams;
  const format = params.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  // Block/shift exports include pending (open/submitted) marks by default.
  const filters = attendanceFiltersFromSearchParams(params, { verifiedOnly: false });
  const selectedShiftIds = filters.shiftIds?.length
    ? filters.shiftIds
    : filters.shiftId
      ? [filters.shiftId]
      : [];
  const wantsPersonLayout =
    params.get('layout') === 'person'
    || params.get('layout') === 'person-day'
    || params.get('layout') === 'person-period'
    || (!params.get('layout') && Boolean(filters.blockId || selectedShiftIds.length > 1));
  const personMode: PersonDayExportMode =
    params.get('layout') === 'person-period' || params.get('mode') === 'period'
      ? 'period'
      : 'day';

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    const rows = await loadAttendanceRows(supabase, {
      ...filters,
      scopedTeamIds,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const scope = params.get('blockId') ? 'block' : params.get('shiftId') ? 'shift' : 'attendance';

    if (wantsPersonLayout) {
      const approvedPeople = await loadApprovedVolunteers(supabase, {
        sector: filters.sector,
        healthSubsector: filters.healthSubsector,
        search: filters.search,
      });
      const personColumns = parsePersonColumns(params.get('columns'));
      const { headers, records } = buildPersonAttendanceExport({
        rows,
        approvedPeople,
        personColumns,
        mode: personMode,
      });

      await logActivity({
        actor: gate.session,
        action: 'attendance.export',
        summary: `${gate.session.fullName} exported ${records.length} volunteer attendance rows`,
        entityType: 'attendance',
        metadata: {
          count: records.length,
          format,
          layout: personMode === 'period' ? 'person-period' : 'person-day',
          columns: personColumns,
          status: filters.status || 'all',
          sector: filters.sector || null,
          period: filters.periods?.join(',') || null,
          blockId: params.get('blockId') || null,
          shiftId: params.get('shiftId') || null,
          verifiedOnly: filters.verifiedOnly !== false,
        },
        request,
      });

      if (format === 'csv') {
        const header = headers.map((column) => csvCell(column)).join(',');
        const body = records
          .map((row) => row.map((cell) => csvCell(cell)).join(','))
          .join('\n');
        return new NextResponse(`${header}\n${body}\n`, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${scope}-by-person-${stamp}.csv"`,
          },
        });
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance by person');
      sheet.addRow(headers);
      for (const row of records) sheet.addRow(row);
      sheet.getRow(1).font = { bold: true };
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${scope}-by-person-${stamp}.xlsx"`,
        },
      });
    }

    const columns = (params.get('columns') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is AttendanceExportColumnId => allowed.has(item));
    const selected = ensureSubcategoryColumns(
      columns.length ? columns : [...DEFAULT_ATTENDANCE_EXPORT_COLUMNS],
    );

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
        layout: 'flat',
        columns: selected,
        status: filters.status || 'all',
        sector: filters.sector || null,
        period: filters.periods?.join(',') || null,
        blockId: params.get('blockId') || null,
        shiftId: params.get('shiftId') || null,
        verifiedOnly: filters.verifiedOnly !== false,
      },
      request,
    });

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
    sheet.getRow(1).font = { bold: true };
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
