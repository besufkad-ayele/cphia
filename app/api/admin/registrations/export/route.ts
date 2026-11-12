import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { logActivity } from '@/app/lib/admin/activity';
import { requireFeature } from '@/app/lib/admin/guard';
import {
  applyNameSort,
  applyRegistrationFilters,
  fetchAllPaged,
  parseSector,
  parseSubsector,
  sanitizeSearch,
} from '@/app/lib/admin/registration-filters';
import { isAdminStatus } from '@/app/lib/admin/status';
import {
  EXPORT_ASSET_COLUMNS,
  EXPORT_COLUMNS,
  type ExportColumnId,
} from '@/app/lib/admin/types';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const standardAllowed = new Set<string>(EXPORT_COLUMNS.map((column) => column.id));
const assetAllowed = new Set<string>(EXPORT_ASSET_COLUMNS.map((column) => column.id));
const assetById = new Map(EXPORT_ASSET_COLUMNS.map((column) => [column.id, column]));
const allLabels = new Map<string, string>([
  ...EXPORT_COLUMNS.map((column) => [column.id, column.label] as const),
  ...EXPORT_ASSET_COLUMNS.map((column) => [column.id, column.label] as const),
]);

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

function formatLanguages(
  value: unknown,
): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const row = item as { language?: string; proficiency?: string };
      if (!row.language) return '';
      return row.proficiency ? `${row.language} (${row.proficiency})` : row.language;
    })
    .filter(Boolean)
    .join('; ');
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const isSuper = gate.session.role === 'super_admin';
  const columns = (request.nextUrl.searchParams.get('columns') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is ExportColumnId => {
      if (standardAllowed.has(item)) return true;
      return isSuper && assetAllowed.has(item);
    });
  const selected: ExportColumnId[] = (() => {
    const base = columns.length
      ? columns
      : (EXPORT_COLUMNS.map((column) => column.id) as ExportColumnId[]);
    // Always keep sector + sub-category columns in volunteer exports.
    const required = ['sector', 'health_subsectors', 'role_subsectors'] as const;
    const next = [...base];
    for (const id of required) {
      if (!next.includes(id)) {
        const sectorAt = next.indexOf('sector');
        next.splice(sectorAt >= 0 ? sectorAt + 1 : next.length, 0, id);
      }
    }
    return next;
  })();
  const format = request.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const statusParam = request.nextUrl.searchParams.get('status');
  const search = sanitizeSearch(request.nextUrl.searchParams.get('search') ?? '');
  const status = statusParam && isAdminStatus(statusParam) ? statusParam : null;
  const sector = parseSector(request.nextUrl.searchParams.get('sector'));
  const subsector = parseSubsector(request.nextUrl.searchParams.get('subsector'));
  const id = request.nextUrl.searchParams.get('id');
  const wantsAssets = selected.some((col) => assetAllowed.has(col));

  const supabase = getSupabaseAdmin();
  let data: Array<Record<string, unknown>> = [];
  try {
    if (id) {
      const single = await supabase
        .from('registrations')
        .select('*, registration_languages(language, proficiency, language_group)')
        .eq('id', id);
      if (single.error) throw single.error;
      data = (single.data ?? []) as Array<Record<string, unknown>>;
    } else {
      const paged = await fetchAllPaged<Record<string, unknown>>(() => {
        let query = supabase
          .from('registrations')
          .select('*, registration_languages(language, proficiency, language_group)', { count: 'exact' });
        query = applyNameSort(query as never) as typeof query;
        query = applyRegistrationFilters(query as never, { status, search, sector, subsector }) as typeof query;
        return query as never;
      });
      data = paged.rows;
    }
  } catch (error) {
    console.error('admin_export_error', error);
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 });
  }

  const signedCache = new Map<string, string>();
  async function signedUrl(path: string | null | undefined) {
    if (!path) return '';
    const cached = signedCache.get(path);
    if (cached) return cached;
    const { data: signed } = await supabase.storage.from('volunteer-photos').createSignedUrl(path, 60 * 60 * 12);
    const url = signed?.signedUrl ?? '';
    if (url) signedCache.set(path, url);
    return url;
  }

  const rows: Array<Record<string, string>> = [];
  for (const row of data) {
    const mapped: Record<string, string> = {};
    for (const col of selected) {
      if (col === 'languages') {
        mapped[col] = formatLanguages(row.registration_languages);
        continue;
      }
      if (assetAllowed.has(col)) {
        const asset = assetById.get(col as (typeof EXPORT_ASSET_COLUMNS)[number]['id']);
        mapped[col] = asset && wantsAssets
          ? await signedUrl(row[asset.pathKey] as string | null | undefined)
          : '';
        continue;
      }
      mapped[col] = cellValue(row[col]);
    }
    rows.push(mapped);
  }

  const labels = selected.map((col) => allLabels.get(col) ?? col);
  const stamp = new Date().toISOString().slice(0, 10);
  const rowCount = rows.length;

  await logActivity({
    actor: gate.session,
    action: 'export.volunteers',
    summary: `${gate.session.fullName} exported ${rowCount} volunteer${rowCount === 1 ? '' : 's'} as ${format.toUpperCase()}`,
    entityType: 'export',
    entityId: stamp,
    metadata: { format, rowCount, status, sector, subsector, search: search || null, columns: selected },
    request,
  });

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPHIA Admin';
    const sheet = workbook.addWorksheet('Volunteers');
    sheet.columns = selected.map((col, index) => ({
      header: labels[index],
      key: col,
      width: Math.max(14, labels[index]!.length + 4),
    }));
    for (const row of rows) {
      sheet.addRow(row);
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

  const csvRows = rows.map((row) => selected.map((col) => csvCell(row[col])).join(','));
  const csv = [labels.map(csvCell).join(','), ...csvRows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cphia-volunteers-${stamp}.csv"`,
    },
  });
}
