-- One shared "floor default" shift so attendance-only staff all work the same open sheet.

alter table public.ops_shifts
  add column if not exists is_floor_default boolean not null default false;

-- At most one floor-default shift at a time.
create unique index if not exists idx_ops_shifts_one_floor_default
  on public.ops_shifts ((true))
  where is_floor_default;
