-- Reason text when admins change volunteer review status (flag, review, pending, etc.).

alter table public.registrations
  add column if not exists review_note text not null default '';

comment on column public.registrations.review_note is
  'Latest reason entered when an admin changed review_status (flag, review, approve, pending).';
