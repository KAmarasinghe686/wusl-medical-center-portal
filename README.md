# WUSL Medical Center Portal

A role-based medical-record portal for students, doctors, faculty reviewers,
workers, and administrators. The application uses Next.js 16 and Supabase.

## Local setup

1. Copy the required Supabase values into `.env.local`:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. Install dependencies and start the application:

   ```bash
   npm install
   npm run dev
   ```

3. Start a local Supabase stack and apply the version-controlled migration:

   ```bash
   npx supabase start
   npx supabase db reset
   ```

The migration in `supabase/migrations` creates the schema, transactional
functions, audit triggers, storage policies, and row-level security policies.
For a linked hosted project, review the target and run `npx supabase db push`.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run test:rls
npm run test:e2e
npm run build
```

`test:rls` requires a running local Supabase stack. Playwright downloads its
Chromium runtime separately with `npx playwright install chromium`.

Regenerate the application database types after a schema change:

```bash
npm run db:types
```

The UI uses a local system-font stack, so production builds do not depend on
Google Fonts or another remote font service.

## User onboarding

Public sign-up is intentionally disabled. Administrators can invite one user
from **Admin → Manage Users** or import up to 500 users from
**Admin → Batch Onboarding**.

Student CSV columns:

```text
index_no,full_name,email,faculty,academic_year,dob,gender,contact_no
```

Applied Sciences student indices are six digits and must match `2x2xxx`.

Personnel CSV columns:

```text
employee_index,full_name,email,role,specialisation
```

Personnel roles are `worker`, `faculty`, or `doctor`. Administrators are
invited individually. Every row is independently compensated on failure and
recorded in `onboarding_imports` / `onboarding_import_rows` for review or
invitation retry.

Production invitations and password recovery require custom SMTP plus exact
local and production `/auth/callback` URLs in Supabase Auth URL Configuration.
