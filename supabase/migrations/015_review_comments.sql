-- Keep a history of review reasons (flag / review notes) per registration.

alter table public.registrations
  add column if not exists review_comments jsonb not null default '[]'::jsonb;

comment on column public.registrations.review_comments is
  'Chronological review reasons: [{id, at, status, note, actorName}]. review_note stays the latest text for export.';

-- Backfill: promote any existing single note into the history once.
update public.registrations
set review_comments = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'at', coalesce(created_at, now()),
    'status', coalesce(review_status, 'review'),
    'note', review_note,
    'actorName', ''
  )
)
where coalesce(trim(review_note), '') <> ''
  and jsonb_typeof(review_comments) = 'array'
  and jsonb_array_length(review_comments) = 0;
