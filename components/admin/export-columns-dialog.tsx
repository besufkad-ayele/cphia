'use client';

import { useState, type ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { EXPORT_ASSET_COLUMNS, EXPORT_COLUMNS } from '@/app/lib/admin/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function ExportColumnsDialog({
  open,
  onOpenChange,
  selectedColumns,
  onSelectedColumnsChange,
  includeAssets,
  columnOptions,
  title = 'Export',
  description = 'Choose columns, then download Excel or CSV.',
  onExport,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedColumns: string[];
  onSelectedColumnsChange: (columns: string[]) => void;
  includeAssets?: boolean;
  /** When set, replaces the default volunteer export columns. */
  columnOptions?: ReadonlyArray<{ id: string; label: string }>;
  title?: string;
  description?: string;
  /** Return a promise so the dialog can show loading and stay open until success/failure. */
  onExport: (format: 'csv' | 'xlsx') => void | Promise<void>;
  children?: ReactNode;
  className?: string;
}) {
  const [busyFormat, setBusyFormat] = useState<'csv' | 'xlsx' | null>(null);
  const busy = Boolean(busyFormat);
  const columns = columnOptions
    ? [...columnOptions]
    : includeAssets
      ? [...EXPORT_COLUMNS, ...EXPORT_ASSET_COLUMNS]
      : [...EXPORT_COLUMNS];
  const allIds = columns.map((column) => column.id);
  const selectedCount = selectedColumns.length;

  async function runExport(format: 'csv' | 'xlsx') {
    if (busy || !selectedCount) return;
    setBusyFormat(format);
    try {
      await onExport(format);
    } catch {
      // Caller shows the error toast; keep the dialog open.
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className={cn('flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl', className)}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4 text-[#e7c15a]" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className={cn('grid gap-4', busy && 'pointer-events-none opacity-60')}>
            {children}

            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Columns</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCount} of {columns.length} selected
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={busy || selectedCount === columns.length}
                    onClick={() => onSelectedColumnsChange(allIds)}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={busy || selectedCount === 0}
                    onClick={() => onSelectedColumnsChange([])}
                  >
                    Unselect all
                  </Button>
                </div>
              </div>
              <div className="grid max-h-52 gap-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/15 p-2 sm:grid-cols-2">
                {columns.map((column) => {
                  const checked = selectedColumns.includes(column.id);
                  return (
                    <label
                      key={column.id}
                      className={cn(
                        'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm transition hover:bg-white/5',
                        checked && 'bg-white/5',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={busy}
                        onCheckedChange={(next) => {
                          onSelectedColumnsChange(
                            next
                              ? [...selectedColumns, column.id]
                              : selectedColumns.filter((id) => id !== column.id),
                          );
                        }}
                      />
                      <span className="leading-snug">{column.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 rounded-none border-t border-border/60 bg-transparent px-6 py-4 sm:justify-between">
          <div className="min-w-0 text-left text-xs text-muted-foreground">
            {busy ? (
              <span className="inline-flex items-center gap-2 text-[#e7c15a]">
                <Loader2 className="size-3.5 animate-spin" />
                Preparing {busyFormat === 'xlsx' ? 'Excel' : 'CSV'} file…
              </span>
            ) : (
              <span>Download starts when the file is ready.</span>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-24"
              disabled={!selectedCount || busy}
              onClick={() => void runExport('csv')}
            >
              {busyFormat === 'csv' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  CSV…
                </>
              ) : (
                'CSV'
              )}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-28"
              disabled={!selectedCount || busy}
              onClick={() => void runExport('xlsx')}
            >
              {busyFormat === 'xlsx' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Excel…
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Excel
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
