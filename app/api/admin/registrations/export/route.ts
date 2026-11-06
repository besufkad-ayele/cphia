import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
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
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  const columns = (request.nextUrl.searchParams.get('columns') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is ExportColumnId => allowed.has(item));
  const selected: ExportColumnId[] = columns.length
    ? columns
    : ['registration_id', 'first_name', 'last_name', 'email', 'phone', 'sector'];
  const format = request.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const statusParam = request.nextUrl.searchParams.get('status');
  const search = (request.nextUrl.searchParams.get('search') ?? '').replace(/[,.%()\\]/g, ' ').trim().slice(0, 80);
  const status = statusParam && isAdminStatus(statusParam) ? statusParam : null;

  const supabase = getSupabaseAdmin();
  let query = supabase.from('registrations').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('review_status', status);
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,fan_number.ilike.%${search}%,registration_id.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('admin_export_error', error);
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 });
  }

  const labels = selected.map((id) => EXPORT_COLUMNS.find((column) => column.id === id)?.label ?? id);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPHIA Admin';
    const sheet = workbook.addWorksheet('Volunteers');
    sheet.columns = selected.map((id, index) => ({
      header: labels[index],
      key: id,
      width: Math.max(14, labels[index].length + 4),
    }));
    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      sheet.addRow(Object.fromEntries(selected.map((id) => [id, cellValue(record[id])])));
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

  const rows = (data ?? []).map((row) => selected.map((id) => csvCell((row as Record<string, unknown>)[id])).join(','));
  const csv = [labels.map(csvCell).join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cphia-volunteers-${stamp}.csv"`,
    },
  });
}
