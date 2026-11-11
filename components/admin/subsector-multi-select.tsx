'use client';

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type SubsectorMultiSelectProps = {
  label: string;
  options: readonly string[];
  value: string[];
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  onChange: (next: string[]) => void;
};

export function SubsectorMultiSelect({
  label,
  options,
  value,
  disabled,
  className,
  triggerClassName,
  onChange,
}: SubsectorMultiSelectProps) {
  const selected = value.filter((item) => options.includes(item));
  const summary =
    selected.length === 0
      ? `Assign ${label.toLowerCase()}`
      : selected.length <= 2
        ? selected.join(', ')
        : `${selected.length} selected`;

  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
      return;
    }
    onChange([...selected, option]);
  }

  return (
    <div className={cn('min-w-0', className)} onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className={cn(
            'inline-flex h-9 w-full max-w-[14rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-left text-xs transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56" onClick={(event) => event.stopPropagation()}>
          <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">{label}</div>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.includes(option)}
              onCheckedChange={() => toggle(option)}
              closeOnClick={false}
            >
              {option}
            </DropdownMenuCheckboxItem>
          ))}
          {selected.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onChange([])}>Clear all</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
