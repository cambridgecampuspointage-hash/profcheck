# Supabase Setup

This project cannot work without a Supabase project. Use these steps once, then the app will run locally and on Vercel.

## 1. Create the project

Create a new project in the Supabase dashboard.

## 2. Run the SQL migrations

Open the Supabase SQL Editor and run these files in this order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_add_reception_role.sql`

## 3. Create your first admin user

In Supabase Dashboard:

1. Go to `Authentication` -> `Users`
2. Create a user with email/password
3. Set `email_confirm` to true if prompted

Then run this SQL in the SQL Editor, replacing the email:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

## 4. Optional: create a reception user

Create another auth user from `Authentication` -> `Users`, then run:

```sql
update public.profiles
set role = 'reception'
where email = 'reception@example.com';
```

Reception users do not need a row in `public.teachers`.

## 5. Optional: create a teacher user

Create another auth user with metadata or manually from `Authentication` -> `Users`.
The trigger from `0001_initial_schema.sql` will automatically create:

- a row in `public.profiles`
- a row in `public.teachers` when the role is `teacher`

If you create the user manually and want to force the role:

```sql
update public.profiles
set role = 'teacher'
where email = 'teacher@example.com';
```

## 6. Add local env vars

Create `.env.local` from `.env.example` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
```

You can find the values in Supabase:

- `Project Settings` -> `API` -> `Project URL`
- `Project Settings` -> `API` -> `anon public`
- `Project Settings` -> `API` -> `service_role`

## 7. Run the app locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 8. What to do first in the app

1. Log in as the admin user
2. Create at least one center
3. Create at least one room
4. Create at least one teacher
5. Open the QR display page for a room
6. Log in as a teacher and test scan flow

## Notes

- QR attendance requires valid center latitude/longitude.
- The app uses the service role key on the server, so never expose it publicly outside env vars.
- Keep `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` for real deployments.
