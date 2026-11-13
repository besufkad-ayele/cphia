import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { logActivity } from '@/app/lib/admin/activity';
import {
  buildVolunteerBlockAttendanceAppendix,
  type BlockAttendanceMark,
  type BlockAttendanceShift,
  type PersonDayExportMode,
} from '@/app/lib/admin/attendance-query';
import { requireFeature } from '@/app/lib/admin/guard';
import {
  applyNameSort,
  applyRegistrationFilters,
  fetchAllPaged,
  parseSector,
  parseSectors,
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

function formatLanguages(value: unknown): string {
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

function chunkIds<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function statusSlug(status: string | null) {
  return status || 'all';
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
  const sectors = parseSectors(
    request.nextUrl.searchParams.get('sectors'),
    request.nextUrl.searchParams.get('sector'),
  );
  const sector = sectors.length === 1 ? sectors[0] : parseSector(request.nextUrl.searchParams.get('sector'));
  const subsector = sectors.length <= 1
    ? parseSubsector(request.nextUrl.searchParams.get('subsector'))
    : null;
  const id = request.nextUrl.searchParams.get('id');
  const wantsAssets = selected.some((col) => assetAllowed.has(col));

  const includeAttendance = request.nextUrl.searchParams.get('includeAttendance') === '1';
  const includeDayColumns = request.nextUrl.searchParams.get('includeDayColumns') === '1';
  const blockIds = [
    ...String(request.nextUrl.searchParams.get('blockIds') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    // Back-compat with single blockId.
    String(request.nextUrl.searchParams.get('blockId') || '').trim(),
  ].filter((id, index, all) => id && all.indexOf(id) === index);
  const verifiedOnly = request.nextUrl.searchParams.get('verifiedOnly') === '1';
  const attendanceMode: PersonDayExportMode =
    request.nextUrl.searchParams.get('attendanceMode') === 'period' ? 'period' : 'day';

  if (includeAttendance && !blockIds.length) {
    return NextResponse.json(
      { error: 'BLOCK_REQUIRED', message: 'Choose at least one bulk sheet to include shift attendance.' },
      { status: 400 },
    );
  }

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
        query = applyRegistrationFilters(query as never, {
          status,
          search,
          sectors,
          sector,
          subsector,
        }) as typeof query;
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

  const identityRows: Array<{ id: string; cells: string[] }> = [];
  for (const row of data) {
    const cells: string[] = [];
    for (const col of selected) {
      if (col === 'languages') {
        cells.push(formatLanguages(row.registration_languages));
        continue;
      }
      if (assetAllowed.has(col)) {
        const asset = assetById.get(col as (typeof EXPORT_ASSET_COLUMNS)[number]['id']);
        cells.push(
          asset && wantsAssets
            ? await signedUrl(row[asset.pathKey] as string | null | undefined)
            : '',
        );
        continue;
      }
      cells.push(cellValue(row[col]));
    }
    identityRows.push({ id: String(row.id), cells });
  }

  let summaryHeaders: string[] = [];
  let dayHeaders: string[] = [];
  let summaryByPersonId = new Map<string, string[]>();
  let dayByPersonId = new Map<string, string[]>();
  let blockName: string | null = null;

  if (includeAttendance && blockIds.length) {
    try {
      const { data: blocks, error: blockError } = await supabase
        .from('ops_shift_blocks')
        .select('id, name')
        .in('id', blockIds);
      if (blockError) throw blockError;
      if (!blocks?.length) {
        return NextResponse.json({ error: 'BLOCK_NOT_FOUND' }, { status: 404 });
      }

      // Preserve UI selection order when possible.
      const blockById = new Map(blocks.map((block) => [block.id, block]));
      const orderedBlocks = blockIds
        .map((id) => blockById.get(id))
        .filter((block): block is { id: string; name: string } => Boolean(block));
      const blockNames = orderedBlocks.map((block) => block.name);
      blockName = blockNames.length === 1
        ? blockNames[0]!
        : `${blockNames.length}-bulks`;

      let shiftsQuery = supabase
        .from('ops_shifts')
        .select('id, shift_date, start_time, block_id')
        .in('block_id', orderedBlocks.map((block) => block.id))
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });
      if (verifiedOnly) {
        shiftsQuery = shiftsQuery.eq('sheet_status', 'verified');
      }
      const { data: shiftRows, error: shiftsError } = await shiftsQuery;
      if (shiftsError) throw shiftsError;

      const shifts: BlockAttendanceShift[] = (shiftRows ?? []).map((shift) => ({
        id: shift.id,
        shift_date: shift.shift_date,
        start_time: String(shift.start_time || '').slice(0, 5),
      }));

      const shiftIds = shifts.map((shift) => shift.id);
      const personIds = identityRows.map((row) => row.id);
      const marks: BlockAttendanceMark[] = [];

      if (shiftIds.length && personIds.length) {
        for (const shiftChunk of chunkIds(shiftIds, 200)) {
          for (const personChunk of chunkIds(personIds, 200)) {
            const { data: markRows, error: marksError } = await supabase
              .from('ops_attendance')
              .select('registration_id, shift_id, status')
              .in('shift_id', shiftChunk)
              .in('registration_id', personChunk);
            if (marksError) throw marksError;
            for (const mark of markRows ?? []) {
              marks.push({
                registration_id: mark.registration_id,
                shift_id: mark.shift_id,
                status: mark.status,
              });
            }
          }
        }
      }

      const appendix = buildVolunteerBlockAttendanceAppendix({
        personIds,
        blockName: blockNames.join(' · '),
        blockNames,
        shifts,
        marks,
        mode: attendanceMode,
        includeDayColumns,
      });
      summaryHeaders = appendix.summaryHeaders;
      dayHeaders = appendix.dayHeaders;
      summaryByPersonId = appendix.summaryByPersonId;
      dayByPersonId = appendix.dayByPersonId;
    } catch (error) {
      console.error('admin_export_attendance_error', error);
      return NextResponse.json({ error: 'ATTENDANCE_EXPORT_FAILED' }, { status: 500 });
    }
  }

  const identityHeaders = selected.map((col) => allLabels.get(col) ?? col);
  // Main sheet: identity + score summary only (day detail goes on a second Excel sheet).
  const mainHeaders = [...identityHeaders, ...summaryHeaders];
  const mainRecords = identityRows.map((row) => [
    ...row.cells,
    ...(summaryByPersonId.get(row.id) ?? summaryHeaders.map(() => '')),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const rowCount = mainRecords.length;
  const filenameBase = [
    'cphia-volunteers',
    statusSlug(status),
    blockName ? blockName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : null,
    includeAttendance ? 'attendance' : null,
    includeDayColumns ? 'by-day' : null,
    stamp,
  ]
    .filter(Boolean)
    .join('-');

  await logActivity({
    actor: gate.session,
    action: 'export.volunteers',
    summary: `${gate.session.fullName} exported ${rowCount} volunteer${rowCount === 1 ? '' : 's'} as ${format.toUpperCase()}`,
    entityType: 'export',
    entityId: stamp,
    metadata: {
      format,
      rowCount,
      status,
      sector: sectors.length === 1 ? sectors[0] : null,
      sectors: sectors.length ? sectors : null,
      subsector,
      search: search || null,
      columns: selected,
      includeAttendance,
      includeDayColumns,
      blockIds: blockIds.length ? blockIds : null,
      blockName,
      attendanceMode: includeAttendance ? attendanceMode : null,
      verifiedOnly: includeAttendance ? verifiedOnly : null,
    },
    request,
  });

  function styleSheet(sheet: ExcelJS.Worksheet, headers: string[], freezeCols: number) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', xSplit: Math.min(freezeCols, headers.length), ySplit: 1 }];
    for (let index = 0; index < headers.length; index += 1) {
      sheet.getColumn(index + 1).width = Math.max(12, Math.min(28, String(headers[index]).length + 2));
    }
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPHIA Admin';
    const sheet = workbook.addWorksheet(includeAttendance ? 'Volunteers + score' : 'Volunteers');
    sheet.addRow(mainHeaders);
    for (const row of mainRecords) sheet.addRow(row);
    // Freeze ID + name columns so score stays readable while scrolling.
    styleSheet(sheet, mainHeaders, Math.min(4, identityHeaders.length));

    if (includeAttendance && includeDayColumns && dayHeaders.length) {
      const daySheet = workbook.addWorksheet('Attendance by day');
      const daySheetHeaders = [...identityHeaders, ...dayHeaders];
      daySheet.addRow(daySheetHeaders);
      for (const row of identityRows) {
        daySheet.addRow([
          ...row.cells,
          ...(dayByPersonId.get(row.id) ?? dayHeaders.map(() => '')),
        ]);
      }
      styleSheet(daySheet, daySheetHeaders, Math.min(4, identityHeaders.length));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  // CSV keeps one flat file: summary first, then optional day columns.
  const csvHeaders = [...mainHeaders, ...dayHeaders];
  const csvRecords = identityRows.map((row) => [
    ...row.cells,
    ...(summaryByPersonId.get(row.id) ?? summaryHeaders.map(() => '')),
    ...(includeDayColumns ? (dayByPersonId.get(row.id) ?? dayHeaders.map(() => '')) : []),
  ]);
  const csv = [
    csvHeaders.map(csvCell).join(','),
    ...csvRecords.map((row) => row.map(csvCell).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
    },
  });
}
