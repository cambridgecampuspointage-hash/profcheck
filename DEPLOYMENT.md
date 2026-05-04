# Deployment Guide

## 1. Push the project to GitHub

From the project root:

```bash
git init
git add .
git commit -m "Initial delivery"
```

Then create a GitHub repository and push the code.

## 2. Create the Vercel project

1. Open `https://vercel.com`
2. Connect GitHub
3. Click `Add New Project`
4. Import this repository
5. Framework: `Next.js`

## 3. Add environment variables in Vercel

Project Settings -> Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
```

## 4. Deploy

Click `Deploy`.

## 5. Post-deploy checks

Test:

- admin login
- teacher login
- reception login
- create teacher
- create reception user
- create center
- create room
- QR display page
- teacher QR scan
- teacher session start/end
- reports
- payments

## 6. Custom domain

If the client has a domain:

1. Open `Project Settings -> Domains`
2. Add the client domain
3. Update:

```env
NEXT_PUBLIC_APP_URL=https://client-domain.com
```

4. Redeploy

## 7. Security

Before production:

- rotate the `SUPABASE_SERVICE_ROLE_KEY`
- update the new key in Vercel
- keep `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`

## 8. Notes for mobile testing

Camera and GPS should be tested on production `https`.
Local HTTP testing on mobile is not reliable for browser permissions.
