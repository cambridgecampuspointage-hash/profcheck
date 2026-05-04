# Client Handoff Checklist

## Access to give the client

- production URL
- admin email
- admin password
- Vercel access
- Supabase access
- GitHub repository access

## What the client should receive

- application URL
- admin login credentials
- short user guide
- technical ownership of the project

## Recommended ownership

The best setup is:

- Vercel project under the client account
- Supabase project under the client account
- GitHub repository under the client account or shared organization

## Admin usage summary

Admin can:

- create teachers
- create reception users
- create centers
- create rooms
- display room QR codes
- view attendance
- view reports
- view payments

## Teacher usage summary

Teacher can:

- log in
- scan QR code
- start a session
- end a session
- view history
- view current session

## Reception usage summary

Reception can:

- log in
- open the reception dashboard
- display room QR codes

## Final checks before delivery

- all migrations executed
- at least one admin account works
- centers and rooms created
- teacher account tested
- reception account tested
- QR display tested
- mobile scan tested on HTTPS
- service role key rotated if previously exposed

## Files useful for setup

- [README.md](./README.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [supabase/SETUP.md](./supabase/SETUP.md)
- [supabase/admin_setup.sql](./supabase/admin_setup.sql)
