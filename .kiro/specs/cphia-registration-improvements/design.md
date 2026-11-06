# Design Document

## Overview

This document describes the technical design for the ten improvements to the CPHIA 2026 volunteer registration system. The changes fall into two categories:

**Backend / data layer** (Requirements 1–5): wire the registration API to Supabase, replace the insecure HMAC session cookie with a signed JWT, enforce env-var–only credentials, unify the shared schema, and deliver a real admin registrations endpoint.

**Frontend / developer experience** (Requirements 6–10): split the 500-line page into step components, add a client-side photo size guard, make error summaries human-readable, export the registration ID as a Canvas PNG, and centralise FormData construction behind a type-safe builder.

No new pages are created. The existing routing, Supabase project, and database schema remain unchanged. The only new dependency recommended is `jose` (for JWT signing and verification), which is a small, standards-compliant library that works in the Node.js Edge and serverless environments that Next.js route handlers use.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  app/register/page.tsx  ←── step components (new)      │
│    ConsentStep · PersonalStep · BackgroundStep          │
│    SectorStep · ReviewStep                              │
│  app/admin/page.tsx  ←── live fetch (replace mocks)    │
└────────────┬────────────────────────────────────────────┘
             │ HTTPS / FormData
┌────────────▼────────────────────────────────────────────┐
│  Next.js Route Handlers (app/api/)                      │
│  POST /api/register        ← persist to Supabase        │
│  POST /api/admin/login     ← issue JWT cookie           │
│  GET  /api/admin/logout    ← clear JWT cookie           │
│  GET  /api/admin/registrations  ← live list (new)       │
└────────────┬────────────────────────────────────────────┘
             │ Supabase JS v2 (service-role key)
┌────────────▼────────────────────────────────────────────┐
│  Supabase                                               │
│  RPC: register_volunteer(payload jsonb)                 │
│  Table: registrations                                   │
│  Table: registration_languages                          │
│  Storage bucket: volunteer-photos                       │
└─────────────────────────────────────────────────────────┘
```

All admin route handlers share a single `verifyAdminSession` helper that reads and validates the JWT from the `cphia_admin_session` cookie. This helper lives in `app/api/admin/_lib/session.ts` and is called at the top of every protected handler.

---

## Components and Interfaces

### New and modified files

#### `app/lib/supabase/server.ts` (new)
Exports a lazily-initialised Supabase client using the service role key. Throws at module load time if `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is absent or empty.

```ts
// app/lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false },
});
```

#### `app/api/admin/_lib/session.ts` (new)
Exports `signAdminJwt(email)` and `verifyAdminSession(request)`. Uses `jose` for HS256 signing and verification. Expiry is 28800 seconds (8 hours).

```ts
// Exported interface (implementation uses jose)
export async function signAdminJwt(email: string): Promise<string>
export async function verifyAdminSession(
  request: NextRequest
): Promise<{ email: string } | null>  // null means invalid/absent/expired
```

`verifyAdminSession` reads the `cphia_admin_session` cookie, calls `jose.jwtVerify`, and returns the payload on success or `null` on any failure (missing cookie, invalid signature, expired token).

#### `app/api/register/route.ts` (updated)
- Imports `supabaseAdmin`.
- After photo validation passes, uploads to Supabase Storage bucket `volunteer-photos` if photo present.
- Calls `supabaseAdmin.rpc('register_volunteer', { payload })`.
- Maps DB error codes to HTTP 409 responses.
- Returns HTTP 201 with `{ registrationId }` on success.

#### `app/api/admin/login/route.ts` (updated)
- Removes all fallback/default values for env vars.
- Reads `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` at handler startup; if any is missing, returns HTTP 500 before any credential comparison.
- On valid credentials, calls `signAdminJwt(email)` and sets the session cookie.

#### `app/api/admin/registrations/route.ts` (new)
```ts
export async function GET(request: NextRequest): Promise<Response>
```
- Calls `verifyAdminSession`; returns HTTP 401 if null.
- Reads optional `status` and `search` query params.
- Queries `registrations` table via `supabaseAdmin`, applies filters, limits to 100 rows ordered by `created_at DESC`.
- Returns JSON array of `RegistrationSummary`.

#### `packages/shared/src/schemas/register.ts` (updated)
- Removes the hard-coded `'UNICEF'` value from the sector enum.
- Imports `SECTORS` from `../constants/sectors` and uses `z.enum([...SECTORS])`.
- Phone validation exports `phoneSchema` for reuse.

#### `app/register/schema.ts` (updated)
- Imports `SECTORS` and `phoneSchema` from `@cphia/shared`.
- Replaces inline sector enums with `z.enum([...SECTORS] as [string, ...string[]])`.
- Replaces inline phone validation with `phoneSchema` in `personalStepSchema` and `backgroundStepSchema`.
- Fixes `reviewStepSchema` sector enum (replaces `'UNICEF'` with `'Transport'`).

#### `app/register/types.ts` (updated)
- Changes `age: string` to `age: number | ''` in `RegisterFormValues`.

#### `app/register/lib/formData.ts` (new)
Exports `buildRegistrationFormData(payload: RegistrationSubmissionPayload, photo: StoredPhoto | null): FormData`.

The exhaustiveness guarantee uses a mapped type:
```ts
type RegistrationFormDataMap = {
  [K in keyof RegistrationSubmissionPayload]: true;
};
// The function body must assign every key in RegistrationFormDataMap or TypeScript errors
```

#### `app/register/lib/errorLabels.ts` (new)
Exports:
- `FIELD_LABEL_MAP: Record<string, string>` — maps field path root segments to display labels.
- `resolveFieldLabel(path: string): string` — looks up the map, falls back to camelCase splitting.

```ts
export const FIELD_LABEL_MAP: Record<string, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  amharicFirstName: 'Amharic first name',
  amharicMiddleName: 'Amharic middle name',
  amharicLastName: 'Amharic last name',
  fullNameAmharic: 'Full name (Amharic)',
  sex: 'Sex',
  age: 'Age',
  nationality: 'Nationality',
  fanNumber: 'FAN number',
  secondIdType: 'Second ID type',
  secondIdNumber: 'Second ID number',
  phone: 'Phone',
  phoneIsWhatsApp: 'Phone is WhatsApp',
  whatsappNumber: 'WhatsApp number',
  whatsappNo: 'No WhatsApp',
  email: 'Email',
  confirmEmail: 'Confirm email',
  residenceRegion: 'Residence region',
  residenceCity: 'Residence city',
  residenceDetail: 'Residence detail',
  profession: 'Profession',
  educationLevel: 'Education level',
  emergencyName: 'Emergency contact name',
  emergencyPhone: 'Emergency contact phone',
  emergencyRelationship: 'Emergency relationship',
  languages: 'Languages',
  sector: 'Sector',
  healthSubsectors: 'Health sub-sectors',
  agree: 'Consent agreement',
};
```

camelCase fallback: split on uppercase letter boundaries, capitalise each word, join with spaces.

#### `app/register/lib/canvasDownload.ts` (new)
Exports `downloadIdAsImage(registrationId: string): void`.
- Creates a 1200×630 canvas.
- Renders title text "CPHIA 2026 Volunteer Registration", the registration ID, and today's date in `YYYY-MM-DD` format.
- Exports as PNG via `canvas.toBlob('image/png')` and triggers download.
- Falls back to the existing SVG download if `canvas.getContext` is falsy or if any error is thrown.

#### Step components (new — `app/register/steps/`)

Each component accepts `UseFormReturn<RegisterFormValues>` props (via `control`, `setValue`, `formState`, and specific callbacks) and renders only its own fields.

| Component | File | Step index | Fields |
|---|---|---|---|
| `ConsentStep` | `app/register/steps/ConsentStep.tsx` | 0 | agree checkbox |
| `PersonalStep` | `app/register/steps/PersonalStep.tsx` | 1 | name, amharic, sex, age, nationality, FAN, IDs, photo, phone, WhatsApp, email, residence |
| `BackgroundStep` | `app/register/steps/BackgroundStep.tsx` | 2 | profession, education, emergency contact, languages |
| `SectorStep` | `app/register/steps/SectorStep.tsx` | 3 | sector, health sub-sectors |
| `ReviewStep` | `app/register/steps/ReviewStep.tsx` | 4 | read-only summary, submit button |

All step components are `'use client'` and receive `form: UseFormReturn<RegisterFormValues>` plus an `onEdit: (step: number) => void` callback for ReviewStep.

#### `app/register/page.tsx` (updated)
- Imports step components from `./steps/`.
- Replaces all inline step JSX with:
  ```tsx
  const STEPS = [ConsentStep, PersonalStep, BackgroundStep, SectorStep, ReviewStep] as const;
  const StepComponent = STEPS[Math.max(step, 0)];
  // render: <StepComponent form={form} ... />
  ```
- Removes the `step === 0 ? 1 : step === 1 ? 2 : ...` chain.
- Calls `buildRegistrationFormData` instead of manual `payload.append` calls.
- Adds the 10 MB client-side photo guard in `uploadPhoto` before calling `imageCompression`.
- Replaces the SVG download with `downloadIdAsImage`.

#### `app/register/hooks/useStepValidation.ts` (updated)
- Updates `stepFieldMap` keys from `{0, 1, 2, 3}` to `{1, 2, 3, 4}` to match the new step indices (step 0 is the consent step).

#### `app/register/components/ui.tsx` — `ErrorSummary` component (updated)
- Imports `resolveFieldLabel` from `../lib/errorLabels`.
- Changes error rendering from `"${field}: ${message}"` to `"${resolveFieldLabel(field)}: ${message}"`.

#### `app/admin/page.tsx` (updated)
- Becomes a `'use client'` component (already is).
- Replaces hard-coded `rows` and `metrics` with state loaded from `GET /api/admin/registrations`.
- Adds `useEffect` to fetch on mount.
- Adds 300 ms debounce on the search input, triggering a re-fetch with `?search=`.
- Status filter chips trigger re-fetch with `?status=` (or no param for "All").
- Handles loading, empty, and error states in the table body.

---

## Data Models

### `RegistrationSummary` (new type — `app/api/admin/registrations/route.ts`)

```ts
type RegistrationSummary = {
  id: string;              // uuid PK
  registrationId: string;  // e.g. CPHIA-26-000001
  name: string;            // first_name + ' ' + last_name
  email: string;
  sector: string;
  residenceRegion: string;
  status: 'pending' | 'approved' | 'review' | 'flagged';
  createdAt: string;       // ISO 8601
  uiLanguage: string;
};
```

`status` is derived from the `email_status` column. The database `email_status` values map directly: `pending → pending`, `sent → approved`, `failed → flagged`. A `review` status is not yet driven by the database column and defaults to `pending` until a separate review workflow is built.

### `RegistrationSubmissionPayload` (updated — `app/register/schema.ts`)

Derived from `RegisterFormValues` via `toSubmissionPayload`:
- `age` coerced to `number`
- `phoneIsWhatsApp` coerced to `boolean`
- `idempotencyKey: string` appended
- `whatsappNumber` cleared if `phoneIsWhatsApp` is true

### Admin JWT payload

```ts
{
  sub: string;    // admin email
  iat: number;    // issued-at (seconds)
  exp: number;    // iat + 28800
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

PBT applies selectively to this feature. Most requirements describe infrastructure wiring, UI rendering, or structural refactors where example-based tests are more appropriate. The seven properties below cover the cases with well-defined universal quantification over meaningful input variation.

The recommended property-based testing library for TypeScript/Node.js is **fast-check** (`npm install -D fast-check`).

---

### Property 1: Photo guard threshold

*For any* file-like object, the `uploadPhoto` handler SHALL accept it (pass it to `browser-image-compression`) if and only if its `size` property is ≤ 10,000,000 bytes; it SHALL reject it synchronously (return an error without calling compression) if and only if its `size` is > 10,000,000 bytes.

**Validates: Requirements 7.1, 7.4**

---

### Property 2: Status filter returns only matching rows

*For any* non-empty dataset of registration summaries with mixed `email_status` values, and *for any* status filter value from `{ pending, approved, review, flagged }`, the registrations endpoint with that filter SHALL return only rows whose derived `status` equals the filter value.

**Validates: Requirements 5.4**

---

### Property 3: Search filter returns only matching rows

*For any* non-empty dataset of registration summaries and *for any* non-empty search string, the registrations endpoint with that search parameter SHALL return only rows where `first_name`, `last_name`, or `email` contains the search string (case-insensitive substring match).

**Validates: Requirements 5.5**

---

### Property 4: Field label resolver always returns a readable string

*For any* field path string drawn from the keys of `RegisterFormValues`, the `resolveFieldLabel` function SHALL return a non-empty string that contains no dot characters and no raw camelCase sequences.

**Validates: Requirements 8.1, 8.2**

---

### Property 5: camelCase fallback produces space-separated capitalised words

*For any* camelCase identifier string (composed of ASCII letters, starting with a lowercase letter), the fallback branch of `resolveFieldLabel` SHALL return a string consisting solely of words separated by single spaces, where the first letter of each word is uppercase.

**Validates: Requirements 8.3**

---

### Property 6: Canvas PNG filename matches registration ID

*For any* valid registration ID string, the `downloadIdAsImage` function SHALL trigger a download whose filename is exactly `<registrationId>.png`.

**Validates: Requirements 9.3**

---

### Property 7: Canvas dimensions and required text are always correct

*For any* valid registration ID string, when `downloadIdAsImage` runs with an available Canvas API, the canvas SHALL be configured with width ≥ 1200 and height ≥ 600, and the draw calls SHALL include the text "CPHIA 2026 Volunteer Registration", the registration ID string, and a date string matching `YYYY-MM-DD` format.

**Validates: Requirements 9.2**

---

## Error Handling

### Registration API (`POST /api/register`)

| Condition | HTTP Status | Body |
|---|---|---|
| Invalid Zod parse | 400 | `{ error: 'INVALID_INPUT', details: ... }` |
| Photo too large (>3 MB) | 400 | `{ error: 'PHOTO_TOO_LARGE' }` |
| Invalid photo MIME/magic | 400 | `{ error: 'INVALID_PHOTO' }` |
| Supabase returns DUPLICATE_* | 409 | `{ error: '<DUPLICATE_CODE>' }` |
| Storage upload error | 500 | `{ error: 'REGISTRATION_FAILED' }` |
| Any other DB / runtime error | 500 | `{ error: 'REGISTRATION_FAILED' }` |
| Success | 201 | `{ registrationId }` |

Photo size is checked first, before MIME/magic-byte validation, so the ordering guarantee in Requirement 1.4 is met.

### Admin login (`POST /api/admin/login`)

| Condition | HTTP Status | Body |
|---|---|---|
| Any required env var missing | 500 | `{ error: 'MISCONFIGURED' }` |
| Wrong email or password | 401 | `{ error: 'INVALID_CREDENTIALS' }` |
| Success | 302 | Redirect to `/admin` with JWT cookie |

### Protected admin routes

| Condition | HTTP Status | Body |
|---|---|---|
| Missing cookie | 401 | `{ error: 'UNAUTHORIZED' }` and `Set-Cookie: maxAge=0` |
| Invalid JWT signature | 401 | same |
| Expired JWT | 401 | same |
| Old HMAC-only format | 401 | same (fails JWT parse) |

### Client-side photo guard

The `uploadPhoto` function in `page.tsx` checks `file.size > 10_000_000` synchronously before calling `browser-image-compression`. If exceeded:
1. The file input ref is cleared via `inputRef.current.value = ''`.
2. `setServerError` (repurposed as `setPhotoError` in the refactored component) is called with the human-readable message.
3. `browser-image-compression` is never invoked.
On the next file selection, the error is cleared before the size check runs.

### Canvas PNG download

`downloadIdAsImage` wraps all canvas operations in a `try/catch`. If `getContext('2d')` returns `null` or any error is thrown, the function silently falls back to the existing SVG download path. No uncaught error propagates.

---

## Testing Strategy

### Unit tests
- `buildRegistrationFormData`: verify all fields appear in FormData; verify photo omitted when `null`.
- `resolveFieldLabel`: verify known keys return expected labels; verify unknown keys return camelCase-split fallback.
- `downloadIdAsImage`: mock Canvas API; verify draw calls and download trigger; verify fallback when `getContext` returns `null`.
- Admin `signAdminJwt` / `verifyAdminSession`: verify JWT structure, expiry, invalid rejection.
- Admin login handler: verify env-var guard, cookie attributes, HMAC cookie rejection.
- Registration API: mock Supabase; verify HTTP codes for each error path and success path.

### Property-based tests (fast-check)
- **Property 1** (photo guard): `fc.integer({ min: 0, max: 20_000_000 })` as file size — assert accepted iff ≤ 10 MB.
- **Property 2** (status filter): `fc.array(fc.record({ email_status: fc.constantFrom('pending', 'sent', 'failed') }), { minLength: 1 })` combined with `fc.constantFrom('pending', 'approved', 'flagged')` as filter — assert all returned rows match.
- **Property 3** (search filter): `fc.array(fc.record({ first_name: fc.string(), last_name: fc.string(), email: fc.emailAddress() }), { minLength: 1 })` with `fc.string({ minLength: 1 })` as query — assert all returned rows match.
- **Property 4** (label resolver): `fc.constantFrom(...Object.keys(FIELD_LABEL_MAP))` — assert result is non-empty, no dots, no unchanged camelCase.
- **Property 5** (camelCase fallback): `fc.stringMatching(/^[a-z][a-zA-Z]*$/)` — assert result has only space-separated capitalised words.
- **Property 6** (PNG filename): `fc.string({ minLength: 1 })` as registration ID — assert download filename equals `id + '.png'`.
- **Property 7** (Canvas dimensions/text): `fc.string({ minLength: 1 })` as registration ID — assert canvas `width ≥ 1200`, `height ≥ 600`, fillText calls contain required strings.

Each property test shall run a minimum of 100 iterations.

Tag format: `// Feature: cphia-registration-improvements, Property {N}: {property_text}`

### Integration tests
- `POST /api/register` with a real Supabase test project (or a local `supabase start` instance): verify record persisted, `registrationId` returned, duplicate codes returned correctly.
- `GET /api/admin/registrations` with a seeded test database: verify rows returned, status filter applied, search applied.

### Build / type checks
- `pnpm type-check` (runs `tsc --noEmit`) should pass with zero errors after the `age: number | ''` type fix, the `toSubmissionPayload` type parameter change, and the mapped-type FormData builder.
- The exhaustiveness check in `buildRegistrationFormData` is validated at compile time: removing any key from the function body should produce a TypeScript error.

---

## Implementation Order

The following sequence minimises risk and keeps the app in a working state at each step:

1. **Req 4** — Unify schemas and fix types. This is a prerequisite for everything else and has no runtime risk (only type changes and removing `'UNICEF'`).
2. **Req 10** — `buildRegistrationFormData` typed builder. Purely additive; no runtime behaviour change.
3. **Req 7** — Client-side photo guard. Small, isolated change to `uploadPhoto`.
4. **Req 8** — Error label mapping + `ErrorSummary` update. Purely cosmetic.
5. **Req 9** — Canvas PNG download. Replaces SVG path with graceful fallback.
6. **Req 6** — Split page into step components. Largest refactor; no new features, so regressions are detectable by visual review.
7. **Req 2** — Remove hard-coded admin credentials. Env-var guard with no fallback.
8. **Req 3** — JWT-based admin session (`jose`). Requires `jose` to be installed first.
9. **Req 1** — Persist registrations to Supabase. Requires `supabaseAdmin` client and env vars.
10. **Req 5** — Real admin dashboard. Requires Req 1 and Req 3 to be in place.
