# Volunteer desk — next features

These eight modules are not built yet. They sit on top of the desk that already exists: volunteers, attendance, shifts, cohorts, forms, team accounts, and roles.

Build them in the order at the bottom. Later modules reuse tables from earlier ones.

## What already exists

| Piece | Where it lives |
| --- | --- |
| Volunteer records | `registrations` (`id`, `registration_id`, `sector`, `cohort`, `review_status`) |
| Cohorts | `ops_cohorts` |
| Shifts | `ops_shifts` (`shift_date`, `start_time`, `end_time`, `capacity`, `sector`, `cohort_id`) |
| Attendance marks | `ops_attendance` (`shift_id`, `registration_id`, `status`, `checked_in_at`) |
| Forms | `ops_forms`, `ops_form_responses` |
| Who can open a module | `ops_roles.permissions` and `admins.permissions` |
| Feature keys | `app/lib/admin/permissions.ts` (`ADMIN_FEATURES`) |
| API gate | `requireFeature()` in `app/lib/admin/guard.ts` |
| Desk shell | `components/admin/admin-shell.tsx` |

New modules follow the same pattern:

1. Add a table in a new file under `supabase/migrations/`.
2. Add a feature key to `ADMIN_FEATURES` so Roles can grant it.
3. Add `app/api/admin/<module>/route.ts` guarded by `requireFeature`.
4. Add a page under `app/admin/(console)/<module>/page.tsx`.
5. The sidebar picks the new key up automatically.

Use `extensions.crypt` for any password work. `pgcrypto` is installed in the `extensions` schema, not `public`.

---

## 1. Live floor board

**What it shows.** One screen for “right now”: every shift that is in progress today, how many people are marked present or late, how many seats are still empty, and the names of people already checked in.

**Why it is first.** Attendance and shifts already store this. The board is a read model, not a new workflow.

### Data

No new table. A shift is “live” when:

- `shift_date` is today in Africa/Addis (the browser sends `date=YYYY-MM-DD`, same as `/api/admin/overview`)
- the current local time is between `start_time` and `end_time`

Counts come from `ops_attendance` where `status` is `present` or `late`. Empty seats are `capacity - present` when `capacity > 0`.

### API

`GET /api/admin/floor?date=YYYY-MM-DD&time=HH:MM`

- Permission: `attendance` (or a new `floor` key if the board should be given out separately).
- Returns one row per in-progress shift: `id`, `name`, `cohort`, `location`, `sector`, `start`, `end`, `capacity`, `present`, `late`, `absent`, `gap`, and a short list of checked-in names.
- Also return the next shift that has not started, so the board is not blank between blocks.

### UI

`app/admin/(console)/floor/page.tsx`

- Big gap number per shift. A gap above zero is the thing the coordinator looks at.
- Refresh every 30 seconds with the same endpoint. Do not hold a websocket for this.
- Link each shift to `/admin/attendance` with that shift selected.

### Implementation

1. Extract the “today’s shifts + attendance counts” query already used by `app/api/admin/overview/route.ts`.
2. Filter to shifts whose time window contains `time`.
3. Add the page and a sidebar entry. The dashboard “Today’s floor” card should link here instead of only listing the day.

---

## 2. QR badge check-in

**What it does.** A shift lead opens a shift, points the phone camera at the volunteer’s registration card, and the desk marks that person present. Typing a name stays as the fallback.

**What the code encodes.** The registration id already printed on the card (`registration_id`, for example `CPHIA-26-000123`), not a new secret. The card component is `components/register/volunteer-id-card.tsx`. Put the same string in a QR on that card.

### Data

No new attendance table. Check-in writes the existing `ops_attendance` row:

- `status`: `present`, or `late` when the scan is after `start_time` plus a grace (start with 15 minutes, store the grace on the shift later if needed)
- `checked_in_at`: now
- `marked_by`: the signed-in admin

Reject a second scan for the same person and shift with “Already marked present” instead of creating a duplicate. The unique key is `(shift_id, registration_id)`.

### API

`POST /api/admin/attendance/scan`

```json
{ "shiftId": "uuid", "registrationId": "CPHIA-26-000123" }
```

- Permission: `attendance`.
- Look up `registrations` by `registration_id` (the public code), not by the internal uuid.
- Return the volunteer name, sector, and the status that was written.
- If the code does not match a registration, return 404 with `UNKNOWN_CODE`.

### UI

A “Scan badge” button on the attendance page for the selected shift.

- Use the browser `BarcodeDetector` API where it exists.
- Where it does not, use a small client library such as `@zxing/browser` loaded only on that page.
- Ask for the camera with `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.
- After a successful scan, pause the camera for one second so the same code is not submitted twice.
- Keep the name search that is already on the attendance page.

### Implementation

1. Add a QR on the volunteer card SVG/canvas using the registration id as the payload. A small server-free QR helper is enough; do not store the image.
2. Add the scan route next to `app/api/admin/attendance/route.ts`. Reuse the upsert already in that file.
3. Add the camera panel to `app/admin/(console)/attendance/page.tsx`.

---

## 3. Training and briefing completion

**What it shows.** A volunteer is cleared to work only after the required briefing for their cohort is done. The floor board and attendance search can show “not cleared” before someone is placed on a shift.

### Data

Use forms that already exist. A form becomes a required briefing when it is flagged, instead of inventing a second form builder.

```sql
alter table public.ops_forms
  add column if not exists required_for_clearance boolean not null default false;

create table if not exists public.ops_clearance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  cohort_id uuid not null references public.ops_cohorts(id) on delete cascade,
  cleared_at timestamptz,
  cleared_by uuid,
  unique (registration_id, cohort_id)
);
```

A person is cleared for a cohort when every form with `required_for_clearance = true` and that `cohort_id` has a row in `ops_form_responses` for them. Write `ops_clearance.cleared_at` at that moment so the floor board does not recompute every form on each paint.

### API

- `PATCH /api/admin/forms/[id]` already saves the form. Add `requiredForClearance` to that payload.
- `GET /api/admin/clearance?cohortId=` returns volunteers with `cleared` true or false and the missing form titles.
- After `POST /api/admin/forms/[id]/responses`, recompute clearance for that volunteer and cohort.

Permission: `forms` to mark a form required, `volunteers` to read the clearance list.

### UI

- On the form detail page, a checkbox: “Required before this cohort can work”.
- On the volunteer list, a small “Cleared” or “Briefing missing” mark when a cohort is selected.
- On attendance search results, show the same mark. Do not block the mark button in the first version; show the warning and let the shift lead decide.

### Implementation

1. Migration for the column and `ops_clearance`.
2. A single function `refreshClearance(registrationId, cohortId)` called from the response route.
3. Checkbox on `app/admin/(console)/forms/[id]/page.tsx`.

---

## 4. No-show replacement pool

**What it shows.** For a shift that still has empty seats, a list of approved volunteers in the same cohort and sector who are not already marked on that shift and not marked present on an overlapping shift.

### Data

No new table. The pool is a query:

- `registrations.review_status = 'approved'`
- `registrations.cohort` equals the shift’s cohort code
- `registrations.sector` equals `ops_shifts.sector` when the shift sector is not empty
- not in `ops_attendance` for this `shift_id`
- not `present` or `late` on another shift the same day whose time overlaps

### API

`GET /api/admin/shifts/[id]/replacements`

Permission: `attendance`.

Returns at most 20 people: name, registration id, phone, sector.

`POST /api/admin/attendance` already adds a person to a shift. The pool’s “Add to shift” button calls that with `status: "present"`.

### UI

On the attendance page, under the gap count, a “Find a replacement” list. Show phone so the coordinator can call. Do not send the SMS from this module; that is the broadcast module.

### Implementation

1. One route that runs the query above.
2. A panel on the attendance page, shown only when `capacity - present > 0`.

---

## 5. Sector staffing

**What it shows.** For a date, each sector’s demand versus how many approved volunteers are marked present. Demand is the sum of `ops_shifts.capacity` for shifts that day with that `sector`. Supply is distinct volunteers marked `present` or `late` on those shifts.

### Data

No new table. Sectors already live on `registrations.sector` and `ops_shifts.sector`. Empty shift sector means “any sector” and should be excluded from this chart so it does not distort a sector row.

### API

`GET /api/admin/staffing?date=YYYY-MM-DD&cohortId=`

Permission: `shifts`.

```json
{
  "rows": [
    { "sector": "Health", "demand": 40, "present": 28, "gap": 12, "approvedPool": 60 }
  ]
}
```

`approvedPool` is the count of approved registrations in that sector and cohort, so a gap can be read against people who exist, not only people who showed up.

### UI

`app/admin/(console)/staffing/page.tsx`

- One row per sector, the gap in gold when it is above zero.
- Clicking a sector filters the shift list to that sector.
- The dashboard can show the single worst gap (“Health is 12 short today”) once this endpoint exists.

### Implementation

1. Group shifts by `sector` for the date.
2. Count attendance with a join, not a row downloaded to Node.
3. Add the page. A table is enough; a chart can wait.

---

## 6. Shift broadcast

**What it does.** A coordinator writes one notice and sends it to everyone marked on a shift, or to every approved volunteer in a cohort. The first version records the notice and the recipient list. Actual SMS or email delivery can be a second step using the Resend setup already in the project.

### Data

```sql
create table public.ops_broadcasts (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.ops_cohorts(id) on delete set null,
  shift_id uuid references public.ops_shifts(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  subject text not null default '',
  body text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.ops_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.ops_broadcasts(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  destination text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error text not null default ''
);
```

Audience rules:

- Shift: `ops_attendance` for that shift, any status except `absent` is optional; start with everyone marked, and let the form choose “present only”.
- Cohort: `registrations` where `cohort` matches and `review_status = 'approved'`.

Skip a recipient with no email when the channel is email, and no phone when the channel is sms. Mark those rows `skipped`.

### API

`POST /api/admin/broadcasts`

```json
{
  "shiftId": "uuid or null",
  "cohortId": "uuid or null",
  "channel": "email",
  "subject": "Gate change",
  "body": "Use gate B from 08:00.",
  "presentOnly": true
}
```

Permission: new feature key `broadcasts`. Only roles that are granted this key can send. Super admin already receives every key.

`GET /api/admin/broadcasts` lists the last 50 notices with recipient counts. Do not return every phone number in the list view.

### UI

A compose card on the shift attendance page (“Message this shift”) and on the cohort detail page (“Message this cohort”). A history list at `/admin/broadcasts`.

### Delivery

- Email: call the existing Resend path used by registration mail. One message per recipient, not one shared To line.
- SMS: leave `status = 'queued'` until a provider is chosen. Do not invent a gateway in this module.
- Write `sent` or `failed` per recipient. A failed send must not roll back the notice.

### Implementation

1. Migration and feature key `broadcasts`.
2. Build the recipient query and insert rows in one request.
3. Send email in the same request only for small lists (under 50). Larger lists should be a follow-up job; do not block the button on hundreds of Resend calls.
4. History page.

---

## 7. Hours ledger

**What it shows.** Hours a volunteer actually attended, per shift and as a total, so a certificate or stipend can be justified. The bank fields already collected at registration stay where they are; this module does not pay anyone.

### Data

Hours are derived, then snapped when a shift is closed so later edits to the shift clock do not rewrite history.

```sql
create table public.ops_shift_hours (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.ops_shifts(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  minutes integer not null check (minutes >= 0),
  source text not null check (source in ('scheduled', 'adjusted')),
  note text not null default '',
  unique (shift_id, registration_id)
);
```

Default minutes for a `present` mark: the length of the shift (`end_time - start_time`). For `late`: the same length minus the minutes after `start_time` until `checked_in_at`, with a floor of 0. `absent` and `excused` get 0 unless someone types an adjustment.

### API

- `POST /api/admin/shifts/[id]/close` writes one `ops_shift_hours` row per attendance mark, `source = 'scheduled'`.
- `PATCH /api/admin/shifts/[id]/hours` body `{ registrationId, minutes, note }` sets `source = 'adjusted'`.
- `GET /api/admin/hours?cohortId=&from=&to=` returns totals per volunteer: name, registration id, sector, minutes, shift count.

Permission: `shifts` to close and adjust, `volunteers` to read the ledger.

### UI

- On the shift, a “Close shift and record hours” button once the end time has passed.
- An hours column on the attendance list after close, with an edit field for the minutes.
- `/admin/hours` with a total per person and a CSV export using the same export style as volunteers.

### Implementation

1. Migration.
2. Close route. Refuse to close twice; adjustments happen through the patch route.
3. Ledger page and CSV. Certificate PDF can wait until the totals are trusted.

---

## 8. Incident and handover notes

**What it shows.** A short log on a shift: what happened, who wrote it, and a handover note for the next shift in the same place.

### Data

```sql
create table public.ops_shift_notes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.ops_shifts(id) on delete cascade,
  kind text not null check (kind in ('note', 'incident', 'handover')),
  body text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
```

`handover` notes are the ones shown at the top of the next shift at the same `location` and cohort. `incident` is the same table with a different kind so the list can be filtered. Do not build a separate incident workflow yet.

### API

- `GET /api/admin/shifts/[id]/notes` returns notes for this shift plus the latest handover from the previous shift at the same location.
- `POST /api/admin/shifts/[id]/notes` body `{ kind, body }`.

Permission: `shifts`. Any role with that key can write. Store `created_by` from the session. Do not allow edit of someone else’s note in the first version; add a new note instead.

### UI

A notes column on the attendance page for the selected shift.

- Previous handover shown first, read-only.
- Composer with three kinds.
- Incident rows use a distinct label so they can be scanned.

### Implementation

1. Migration.
2. The two routes.
3. The panel on the attendance page. No new top-level sidebar item; notes belong to the shift.

---

## Suggested build order

| Order | Module | Depends on |
| --- | --- | --- |
| 1 | Live floor board | Shifts and attendance, already in place |
| 2 | QR badge check-in | Attendance upsert |
| 3 | Sector staffing | Shift `sector` and `capacity` |
| 4 | Replacement pool | Floor gap plus approved volunteers |
| 5 | Training clearance | Forms and responses |
| 6 | Hours ledger | Attendance status and shift times |
| 7 | Handover notes | Shifts |
| 8 | Broadcast | Recipient rules from shifts, cohorts, and attendance |

Each module gets one migration, one feature key if it is a new door in the sidebar, and one page or a panel on attendance. Roles already decide who can open a door; grant the new key from the Roles screen instead of hard-coding names.
