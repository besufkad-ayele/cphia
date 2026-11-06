# Requirements Document

## Introduction

This document captures the requirements for improving the CPHIA 2026 volunteer registration application. The system currently has a functional multi-step registration form (React Hook Form + Zod, four steps, draft persistence via IndexedDB/localStorage) with a Next.js app-router backend and a Supabase database whose schema is already migrated. However, critical gaps exist: the API route does not persist data, the admin session system is insecure, schemas have drifted between the frontend and backend, and the admin dashboard shows only hard-coded mock data. Additionally, several code-quality and UX issues degrade maintainability and the applicant experience.

The improvements are grouped into five areas:

1. **Data persistence** — wire the registration API to Supabase.
2. **Security** — harden admin authentication and session management.
3. **Schema consistency** — unify sector/field definitions across frontend and backend.
4. **Admin dashboard** — replace mock data with a real API-backed list of registrations.
5. **Code quality and UX** — split the monolithic page component, fix type safety, improve error presentation, and address minor photo/ID issues.

## Glossary

- **Registration_API**: The Next.js route handler at `app/api/register/route.ts`.
- **Admin_API**: The Next.js route handlers under `app/api/admin/`.
- **Admin_Dashboard**: The React page at `app/admin/page.tsx`.
- **Shared_Schema**: The Zod schema and TypeScript types in `packages/shared/src/schemas/register.ts` and `packages/shared/src/constants/`.
- **Frontend_Schema**: The Zod schemas in `app/register/schema.ts` (used by React Hook Form).
- **Supabase_Function**: The PostgreSQL function `register_volunteer(payload jsonb)` already defined in the database migration.
- **Session_Cookie**: The HTTP-only cookie `cphia_admin_session` used to authenticate admin requests.
- **Idempotency_Key**: A UUID generated per browser session, stored in `localStorage`, and sent with every registration attempt to prevent duplicate submissions.
- **Draft**: The in-progress form state persisted to `localStorage` (field values) and IndexedDB (photo blob).
- **Step_Component**: A self-contained React component responsible for rendering a single step of the multi-step registration form.
- **Photo_Compression**: The `browser-image-compression` library used to shrink uploaded images before storing in IndexedDB and submitting.

---

## Requirements

### Requirement 1: Persist Registrations to Supabase

**User Story:** As a conference organiser, I want every submitted registration to be stored in the database, so that volunteer records are not lost and can be managed through the admin dashboard.

#### Acceptance Criteria

1. WHEN a valid registration `FormData` request is received by the Registration_API, THE Registration_API SHALL call the Supabase_Function `register_volunteer` with the validated payload and persist the record to the database.
2. WHEN the Supabase_Function returns `{ registrationId }`, THE Registration_API SHALL respond with HTTP 201 and a JSON body containing `{ registrationId }`.
3. IF the Supabase_Function returns an error code of `DUPLICATE_EMAIL`, `DUPLICATE_PHONE`, `DUPLICATE_FAN`, or `DUPLICATE_DEVICE`, THEN THE Registration_API SHALL respond with HTTP 409 and a JSON body containing `{ error: <code> }`.
4. IF a photo `File` is present in the request, THEN THE Registration_API SHALL check the file size before performing MIME-type or magic-byte validation.
5. IF the photo `File` size exceeds 3 MB, THEN THE Registration_API SHALL respond with HTTP 400 and `{ error: 'PHOTO_TOO_LARGE' }` without calling the Supabase_Function.
6. IF the photo `File` size is within 3 MB and its MIME type is not one of `image/jpeg`, `image/png`, or `image/webp`, or its magic bytes do not match a JPEG, PNG, or WebP file, THEN THE Registration_API SHALL respond with HTTP 400 and `{ error: 'INVALID_PHOTO' }` without calling the Supabase_Function.
7. IF a photo `File` is present, passes size and MIME/magic-byte validation, THEN THE Registration_API SHALL upload the photo to Supabase Storage and include the resulting `photo_path` in the payload passed to the Supabase_Function.
8. IF a database error, a Supabase Storage upload error, or any other unexpected error occurs and is not a known duplicate error code, THEN THE Registration_API SHALL respond with HTTP 500 and `{ error: 'REGISTRATION_FAILED' }` and log the error server-side.
9. THE Registration_API SHALL read the Supabase connection from the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and SHALL throw at startup if either variable is absent.

---

### Requirement 2: Remove Hard-Coded Admin Credentials

**User Story:** As a security auditor, I want admin credentials to exist only in environment variables, so that secrets are never embedded in source code and are rotatable without a code deployment.

#### Acceptance Criteria

1. THE Admin_API login handler SHALL read the expected email and password exclusively from the environment variables `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.
2. IF any of `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, or `ADMIN_SESSION_SECRET` is absent or empty at server startup, THEN THE Admin_API login handler SHALL respond to any incoming request with an error response before performing any credential comparison.
3. THE Admin_API login handler SHALL read the session signing secret exclusively from the environment variable `ADMIN_SESSION_SECRET`.
4. IF any of `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, or `ADMIN_SESSION_SECRET` is absent or empty at server startup, THEN THE Admin_API login handler SHALL NOT substitute any literal, default, or fallback value for the missing variable.
5. WHEN the Admin_API login handler performs a credential comparison, THE Admin_API login handler SHALL use only the values resolved from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` as the reference credentials.

---

### Requirement 3: Replace the Weak Custom Session with a Signed JWT

**User Story:** As a security auditor, I want admin sessions to be time-limited and tamper-evident, so that a stolen cookie cannot be replayed indefinitely.

#### Acceptance Criteria

1. WHEN an admin submits valid credentials, THE Admin_API login handler SHALL generate a signed JWT containing the admin email and an expiry of 28800 seconds (8 hours), signed with `ADMIN_SESSION_SECRET` using HS256.
2. THE Admin_API login handler SHALL set the Session_Cookie to the signed JWT value with `httpOnly: true`, `sameSite: 'lax'`, and `maxAge` equal to 28800 seconds.
3. WHERE the application is running in a production environment (`NODE_ENV === 'production'`), THE Admin_API login handler SHALL set the Session_Cookie with `secure: true`.
4. WHEN a request is made to any admin route except the login endpoint, THE Admin_API SHALL verify the JWT signature and expiry before granting access.
5. IF the Session_Cookie is absent, the JWT signature is invalid, or the token is expired, THEN THE Admin_API SHALL respond with HTTP 401 and set the Session_Cookie with `maxAge` of 0 to clear it.
6. THE Admin_API SHALL NOT accept the previous HMAC-only session cookie format as valid authentication.

---

### Requirement 4: Unify Sector and Field Definitions Across Frontend and Backend

**User Story:** As a developer, I want a single authoritative source for sector options and shared field rules, so that schema drift between the form and the API is impossible.

#### Acceptance Criteria

1. THE Shared_Schema SHALL define the sector enum as `z.enum([...SECTORS])` where `SECTORS` is `['Health', 'Tourism', 'Culture and Sport', 'MoFA', 'Transport']` imported from `packages/shared/src/constants/sectors.ts`, and SHALL NOT contain the value `'UNICEF'` in its sector field.
2. THE Frontend_Schema SHALL import `SECTORS` from `packages/shared` and derive its sector enum using `z.enum([...SECTORS])`, and SHALL NOT declare a separate inline sector enum.
3. THE Shared_Schema `registrationSchema` SHALL use `z.enum([...SECTORS])` for its sector field so that adding a value to `SECTORS` automatically updates both the frontend and backend validators without modifying the schema files directly.
4. IF the sector enum in `reviewStepSchema` contains the value `'UNICEF'`, THEN THE Frontend_Schema SHALL replace it with `'Transport'` so that `reviewStepSchema` sector enum matches the canonical `SECTORS` values.
5. THE Frontend_Schema SHALL import `phoneSchema` from Shared_Schema and use it as the phone validation rule in `personalStepSchema` and `backgroundStepSchema`, and SHALL NOT define a separate inline phone regex or string-length rule for phone fields.
6. THE `RegisterFormValues` type SHALL declare `age` as `number | ''` instead of `string`, so that numeric coercion is applied before the value reaches the API boundary.

---

### Requirement 5: Real Admin Dashboard — Registration List API

**User Story:** As an admin, I want the dashboard to display live registration data, so that I can monitor, search, and act on actual applicant records.

#### Acceptance Criteria

1. THE system SHALL expose a new Admin_API endpoint at `GET /api/admin/registrations` that requires a valid Session_Cookie.
2. WHEN a valid Session_Cookie is present, THE Admin_API registrations endpoint SHALL query the Supabase `registrations` table and return a JSON array of registration summaries ordered by `created_at` descending, limited to 100 rows per request.
3. THE registration summary object SHALL include at minimum: `id`, `registrationId`, `name` (concatenation of `first_name` and `last_name`), `email`, `sector`, `residenceRegion`, `status` (derived from `email_status`), `createdAt`, and `uiLanguage`.
4. THE Admin_API registrations endpoint SHALL support an optional `status` query parameter whose accepted values are `pending`, `approved`, `review`, and `flagged`; WHEN present, THE endpoint SHALL filter results to rows whose `email_status` matches that value.
5. THE Admin_API registrations endpoint SHALL support an optional `search` query parameter; WHEN present and non-empty, THE endpoint SHALL apply a case-insensitive substring match to `first_name`, `last_name`, and `email`; WHEN absent or empty, THE endpoint SHALL return all rows without a search filter.
6. IF the Session_Cookie is absent or invalid, THEN THE Admin_API registrations endpoint SHALL respond with HTTP 401.
7. WHEN the Admin_Dashboard page loads, THE Admin_Dashboard SHALL fetch data from `GET /api/admin/registrations` and render the returned records in the table, replacing all hard-coded mock rows.
8. WHEN the admin types in the search input, THE Admin_Dashboard SHALL debounce the input by 300 ms and re-fetch from the registrations endpoint with the updated `search` parameter.
9. WHEN the admin selects a status filter chip, THE Admin_Dashboard SHALL re-fetch from the registrations endpoint with the corresponding `status` parameter; WHEN the admin selects the "All" chip, THE Admin_Dashboard SHALL re-fetch without a `status` parameter.
10. IF the registrations endpoint returns an error or an empty array, THEN THE Admin_Dashboard SHALL display an appropriate message in the table body instead of rendering rows.

---

### Requirement 6: Split the Monolithic Registration Page into Step Components

**User Story:** As a developer, I want each registration step to be its own component, so that the page file is readable, each step can be tested in isolation, and adding a new step does not require editing a 500-line file.

#### Acceptance Criteria

1. THE system SHALL introduce a `ConsentStep` component (step index 0), a `PersonalStep` component (step index 1), a `BackgroundStep` component (step index 2), a `SectorStep` component (step index 3), and a `ReviewStep` component (step index 4), each responsible for rendering its own form fields and not managing a separate form state.
2. THE `app/register/page.tsx` file SHALL delegate rendering of each step to the corresponding Step_Component and SHALL NOT contain inline JSX for individual form fields.
3. EACH Step_Component SHALL accept the React Hook Form `control`, `formState`, and any required `setValue` or callback props, and SHALL NOT instantiate its own `useForm` hook.
4. THE step navigation SHALL use a data-driven array (e.g., `const STEPS = [ConsentStep, PersonalStep, ...]`) where the active step component is selected by array index, eliminating the chain of `step === 0 ? 1 : step === 1 ? 2 : ...` conditionals; the `useStepValidation` field map SHALL be updated to align with the new step indices.
5. THE `toSubmissionPayload` function SHALL accept `RegisterFormValues` as its first parameter type instead of `any`.

---

### Requirement 7: Client-Side Photo Guard Before Compression

**User Story:** As a mobile user, I want the app to reject oversized photos immediately on the client, so that an accidental 50 MB file does not freeze my browser.

#### Acceptance Criteria

1. WHEN a user selects or captures a photo and the raw `File` size exceeds 10 MB, THE Registration_Form SHALL reject the file synchronously, before invoking `browser-image-compression`, clear the file input to remove the selection, and display an inline error message.
2. THE inline error message for an oversized file SHALL contain both a human-readable description of the problem and the 10 MB size limit (e.g., "Photo must be under 10 MB. Please choose a smaller image.").
3. WHEN a user selects a new file after an oversized rejection, THE Registration_Form SHALL clear the inline photo error message before processing the new file.
4. WHEN a user selects or captures a photo and the raw `File` size is 10 MB or less, THE Registration_Form SHALL pass the file to `browser-image-compression` without modification, as it currently does.

---

### Requirement 8: Improve Error Summary Readability

**User Story:** As an applicant, I want validation errors to be displayed in plain language, so that I understand what to fix without decoding dot-notation field paths.

#### Acceptance Criteria

1. WHEN the `ErrorSummary` component renders a validation error, IT SHALL display a human-readable label instead of the raw dot-notation path, in the format `"Label: message"` (e.g., `"Languages: Select at least one language"` instead of `"languages.0.language: ..."`).
2. THE system SHALL maintain a mapping from field path root segments to display labels covering all fields in `RegisterFormValues` (e.g., `languages` → `"Languages"`, `emergencyPhone` → `"Emergency contact phone"`).
3. WHEN a field path root segment has no entry in the label mapping, THE `ErrorSummary` component SHALL fall back to splitting the key on uppercase letter boundaries, capitalising the first letter of each resulting word, and joining with spaces (e.g., `residenceCity` → `"Residence City"`).

---

### Requirement 9: Canvas-Based PNG Download for Registration ID

**User Story:** As an applicant, I want to save my registration ID as a PNG image, so that the file opens reliably on my mobile device instead of showing raw SVG markup.

#### Acceptance Criteria

1. WHEN an applicant clicks "Save as image", THE Registration_Form SHALL render the registration ID onto an HTML5 Canvas element and export it as a PNG data URL.
2. THE exported PNG SHALL have a minimum width of 1200 px and a minimum height of 600 px, and SHALL include the text "CPHIA 2026 Volunteer Registration", the registration ID rendered at a font size of at least 32 px, and the export date in `YYYY-MM-DD` format.
3. THE Registration_Form SHALL trigger a browser download of the PNG file with the filename `<registrationId>.png`.
4. IF the Canvas API is not available in the current browser (i.e., `document.createElement('canvas').getContext` is falsy), THEN THE Registration_Form SHALL fall back to the existing SVG download and SHALL NOT throw an uncaught error.
5. IF an error occurs during Canvas rendering or PNG export (other than Canvas API unavailability), THEN THE Registration_Form SHALL fall back to the SVG download, display an inline error message, and SHALL NOT throw an uncaught error.

---

### Requirement 10: Typed FormData Builder

**User Story:** As a developer, I want FormData construction to be centralised and type-checked, so that adding or renaming a field does not silently break the submission payload.

#### Acceptance Criteria

1. THE system SHALL introduce a `buildRegistrationFormData` function that accepts a value of the type `RegistrationSubmissionPayload` (derived from `RegisterFormValues` via `toSubmissionPayload`) and a `StoredPhoto | null` parameter and returns a `FormData` object.
2. THE `buildRegistrationFormData` function SHALL use a mapped type or equivalent TypeScript construct so that the TypeScript compiler produces an error if a key present in `RegistrationSubmissionPayload` is omitted from the FormData construction logic.
3. IF the `StoredPhoto` parameter is `null`, THEN `buildRegistrationFormData` SHALL omit the `photo` field from the returned `FormData`.
4. THE `buildRegistrationFormData` function SHALL be the sole location in the codebase where `FormData` keys for the registration submission are declared.
5. THE `submit` handler in `app/register/page.tsx` SHALL call `buildRegistrationFormData` instead of manually calling `payload.append` for each field.
