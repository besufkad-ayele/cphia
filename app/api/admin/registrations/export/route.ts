import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { logActivity } from '@/app/lib/admin/activity';
import { requireFeature } from '@/app/lib/admin/guard';
import {
  applyNameSort,
  applyRegistrationFilters,
  parseSector,
  parseSubsector,
  sanitizeSearch,
} from '@/app/lib/admin/registration-filters';
import { isAdminStatus } from '@/app/lib/admin/status';
import { EXPORT_COLUMNS } from '@/app/lib/admin/types';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

type ExportColumnId = (typeof EXPORT_COLUMNS)[number]['id'];
const allowed = new Set<string>(EXPORT_COLUMNS.map((column) => column.id));

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function cellValue(value: unknown) {
  if (Array.isArray(value)) return value.join('; ');
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const columns = (request.nextUrl.searchParams.get('columns') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is ExportColumnId => allowed.has(item));
  const selected: ExportColumnId[] = columns.length
    ? columns
    : ['registration_id', 'first_name', 'last_name', 'email', 'phone', 'sector', 'health_subsectors', 'cohort'];
  const format = request.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const statusParam = request.nextUrl.searchParams.get('status');
  const search = sanitizeSearch(request.nextUrl.searchParams.get('search') ?? '');
  const status = statusParam && isAdminStatus(statusParam) ? statusParam : null;
  const sector = parseSector(request.nextUrl.searchParams.get('sector'));
  const subsector = parseSubsector(request.nextUrl.searchParams.get('subsector'));
  const id = request.nextUrl.searchParams.get('id');

  const supabase = getSupabaseAdmin();
  let query = supabase.from('registrations').select('*');
  if (id) {
    query = query.eq('id', id);
  } else {
    query = applyNameSort(query as never) as typeof query;
    query = applyRegistrationFilters(query as never, { status, search, sector, subsector }) as typeof query;
  }

  const { data, error } = await query;
  if (error) {
    console.error('admin_export_error', error);
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 });
  }

  const labels = selected.map((col) => EXPORT_COLUMNS.find((column) => column.id === col)?.label ?? col);
  const stamp = new Date().toISOString().slice(0, 10);
  const rowCount = data?.length ?? 0;

  await logActivity({
    actor: gate.session,
    action: 'export.volunteers',
    summary: `${gate.session.fullName} exported ${rowCount} volunteer${rowCount === 1 ? '' : 's'} as ${format.toUpperCase()}`,
    entityType: 'export',
    entityId: stamp,
    metadata: { format, rowCount, status, sector, subsector, search: search || null },
    request,
  });

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPHIA Admin';
    const sheet = workbook.addWorksheet('Volunteers');
    sheet.columns = selected.map((col, index) => ({
      header: labels[index],
      key: col,
      width: Math.max(14, labels[index].length + 4),
    }));
    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      sheet.addRow(Object.fromEntries(selected.map((col) => [col, cellValue(record[col])])));
    }
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cphia-volunteers-${stamp}.xlsx"`,
      },
    });
  }

  const rows = (data ?? []).map((row) => selected.map((col) => csvCell((row as Record<string, unknown>)[col])).join(','));
  const csv = [labels.map(csvCell).join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cphia-volunteers-${stamp}.csv"`,
    },
  });
}
