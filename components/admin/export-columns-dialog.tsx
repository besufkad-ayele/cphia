'use client';

import type { ReactNode } from 'react';
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
  onExport: (format: 'csv' | 'xlsx') => void;
  children?: ReactNode;
}) {
  const columns = columnOptions
    ? [...columnOptions]
    : includeAssets
      ? [...EXPORT_COLUMNS, ...EXPORT_ASSET_COLUMNS]
      : [...EXPORT_COLUMNS];
  const allIds = columns.map((column) => column.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <div className="grid max-h-72 gap-2 overflow-y-auto">
          {columns.map((column) => (
            <label key={column.id} className="flex min-h-10 items-center gap-2 text-sm">
              <Checkbox
                checked={selectedColumns.includes(column.id)}
                onCheckedChange={(checked) => {
                  onSelectedColumnsChange(
                    checked
                      ? [...selectedColumns, column.id]
                      : selectedColumns.filter((id) => id !== column.id),
                  );
                }}
              />
              {column.label}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onSelectedColumnsChange(allIds)}>
            Select all
          </Button>
          <Button
            variant="outline"
            className="h-11"
            disabled={!selectedColumns.length}
            onClick={() => onExport('csv')}
          >
            CSV
          </Button>
          <Button className="h-11" disabled={!selectedColumns.length} onClick={() => onExport('xlsx')}>
            Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
