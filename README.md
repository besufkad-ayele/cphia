# CPHIA Facility Volunteer Training Registration System

This repository contains the monorepo for the public volunteer registration site and the admin portal for managing registrations and approvals.

## Stack

- Next.js 16 monorepo with apps under `apps/`
- Shared constants and validation schemas under `packages/shared`
- Supabase Postgres for data persistence and unique enforcement
- Route handlers in the web app for all server-side registration logic
- Zod validation before any insertion is attempted

## Local setup

1. Install dependencies:
   `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in the required values.
3. Start the web app:
   `pnpm dev:web`
4. Start the admin app:
   `pnpm dev:admin`

## Required environment variables

See `.env.example` for the baseline settings.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPER_ADMIN_EMAIL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `FINGERPRINT_STRICT`

## Database and schema notes

The SQL migration at `supabase/migrations/001_initial_schema.sql` creates the core tables, indexes, sequence, and `register_volunteer` RPC function. It enforces required uniqueness on FAN, email, phone, device token and idempotency key in Postgres so the database remains the source of truth.

## Device and duplicate enforcement

The device lock is a convenience barrier and an extra server-side check. A second attempt from the same device is blocked by the `DUPLICATE_DEVICE` path. The real per-person guarantee is the FAN, email and phone uniqueness in Postgres. Fingerprint matching is stored as a soft review flag and can be made strict by setting `FINGERPRINT_STRICT=true`.

## Known limits

- A device token cannot stop someone using a different browser, a private window, or after clearing all site storage.
- The per-person guarantee is the unique FAN number, phone and email.
- The device lock and fingerprint signal are advisory guardrails for review and one-device compliance.

## Event-day sizing

For 300+ concurrent submissions, use a Supabase plan sized to accommodate the write burst and monitor connections, CPU and transaction duration. Since each registration goes through a single RPC call and the write set is constrained, the app is designed to keep the DB round trip count low.

## Load testing

A sample k6 script is provided in `k6/register-load-test.js` for simulating 300 concurrent submissions.

## Security and privacy

- Do not log FAN numbers, phone numbers, national IDs or photo metadata.
- Keep all secrets in environment variables only.
- The public app never talks directly to Supabase tables.
- All registration logic runs through the server-side route handler and the Supabase service role.

## Deliverables progress

Stage 1 completed: Supabase schema, unique constraints, and the initial `/api/register` validation route are in place.

Remaining stages:

1. Public form with 3 steps, draft persistence, i18n and golden loading state
2. Admin portal and Excel export
3. Final load test and bug fixes
