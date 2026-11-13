'use client';

import { SECTORS } from '@cphia/shared/constants';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type SectorMultiSelectProps = {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** Compact dropdown-style summary + checklist for tight dialogs. */
  dense?: boolean;
};

/** Multi-sector checklist for export / report downloads. Empty = all sectors. */
export function SectorMultiSelect({
  value,
  onChange,
  className,
  dense = false,
}: SectorMultiSelectProps) {
  const selected = value.filter((item) => (SECTORS as readonly string[]).includes(item));

  function toggle(sector: string) {
    if (selected.includes(sector)) {
      onChange(selected.filter((item) => item !== sector));
      return;
    }
    onChange([...selected, sector]);
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {selected.length === 0
            ? 'All sectors'
            : selected.length === 1
              ? `1 sector: ${selected[0]}`
              : `${selected.length} sectors selected`}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            onClick={() => onChange([...SECTORS])}
          >
            Select all
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>
      <div
        className={cn(
          'grid gap-1.5',
          dense ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3',
        )}
      >
        {SECTORS.map((sector) => {
          const checked = selected.includes(sector);
          return (
            <label
              key={sector}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition',
                checked
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border/70 bg-background/40 hover:border-border',
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(sector)}
              />
              <span className="truncate">{sector}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
