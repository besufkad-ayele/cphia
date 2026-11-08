-- Group bulk-created morning/afternoon shifts into a reportable block.

create table if not exists public.ops_shift_blocks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.ops_cohorts(id) on delete cascade,
  team_id uuid references public.ops_teams(id) on delete set null,
  kind text not null default 'training' check (kind in ('training', 'ops')),
  name text not null,
  start_date date not null,
  end_date date not null,
  location text not null default '',
  capacity integer not null default 0,
  notes text not null default '',
  created_by uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ops_shifts
  add column if not exists block_id uuid references public.ops_shift_blocks(id) on delete set null;

create index if not exists idx_ops_shift_blocks_cohort on public.ops_shift_blocks (cohort_id);
create index if not exists idx_ops_shift_blocks_team on public.ops_shift_blocks (team_id);
create index if not exists idx_ops_shifts_block on public.ops_shifts (block_id);

alter table public.ops_shift_blocks enable row level security;
revoke all on public.ops_shift_blocks from anon, authenticated;
