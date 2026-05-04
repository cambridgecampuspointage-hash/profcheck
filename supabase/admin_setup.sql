-- Replace the email values before running.

-- Promote your first account to admin.
update public.profiles
set role = 'admin'
where email = 'admin@example.com';

-- Optional: create a reception account by first creating the auth user,
-- then running this update.
update public.profiles
set role = 'reception'
where email = 'reception@example.com';

-- Optional: force a user to be a teacher.
update public.profiles
set role = 'teacher'
where email = 'teacher@example.com';
