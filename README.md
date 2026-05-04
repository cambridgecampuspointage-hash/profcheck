# ProfCheck

ProfCheck est une application de pointage pour centres de langues.  
Elle permet de gérer les professeurs, les réceptionnistes, les salles, les QR codes de pointage, les sessions de présence et les rapports de paiement.

## Stack

- Next.js 16
- React 19
- Supabase
- QR code
- Géolocalisation navigateur

## Rôles

- `admin`
- `teacher`
- `reception`

## Fonctionnalités principales

- connexion sécurisée avec Supabase Auth
- création de professeurs et réceptionnistes
- gestion des centres et des salles
- affichage de QR codes par salle
- scan QR côté professeur
- validation GPS au moment du pointage
- calcul de durée de session
- rapports et paiements

## Installation locale

1. Installer les dépendances

```bash
npm install
```

2. Créer le fichier d'environnement

```bash
cp .env.example .env.local
```

3. Remplir `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
```

4. Exécuter les migrations Supabase dans cet ordre

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_rls_policies.sql`
- `supabase/migrations/0003_add_reception_role.sql`

5. Lancer le projet

```bash
npm run dev
```

6. Ouvrir

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Déploiement

Le déploiement recommandé est Vercel.

Variables requises en production:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
```

Voir aussi:

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [CLIENT_HANDOFF.md](./CLIENT_HANDOFF.md)
- [supabase/SETUP.md](./supabase/SETUP.md)

## Important

- Ne pas commit `.env.local`
- Régénérer la `SUPABASE_SERVICE_ROLE_KEY` avant mise en production si elle a été partagée
- Tester caméra et GPS sur une URL `https`, pas seulement en local
