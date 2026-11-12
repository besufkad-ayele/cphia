-- Multi-sector tags on shifts + one floor-default bulk block.

alter table public.ops_shifts
  add column if not exists sectors text[] not null default '{}';

update public.ops_shifts
set sectors = array[sector]
where coalesce(sector, '') <> ''
  and (sectors = '{}' or sectors is null);

comment on column public.ops_shifts.sectors is
  'Optional multi-select sector tags for the shift roster / sheet.';

alter table public.ops_shift_blocks
  add column if not exists is_floor_default boolean not null default false;

create unique index if not exists idx_ops_shift_blocks_one_floor_default
  on public.ops_shift_blocks ((true))
  where is_floor_default;
