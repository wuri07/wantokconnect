# WantokConnect Market

A mobile-first marketplace for small businesses, service providers and customers in Papua New Guinea. Dark theme (black, neon red, gold), email login, a search bar plus one Filter button (region, province, category), posts with several photos and files, live In Stock / Out of Stock, WhatsApp arrangement, notifications, messages and feedback.

**Stack:** Vite (vanilla JS) front end, Supabase (Postgres, Auth, Storage, Realtime), and a small Node/Express server that serves the built site, a health check and an admin route for storefront badges.

```
index.html                   Vite entry point (must be at the TOP of the repo)
package.json                 scripts: build (vite build), start (node server/index.js)
vite.config.js  render.yaml  .env.example  .gitignore
public/                      sw.js (offline app shell), manifest.webmanifest, icon.svg
src/                         main.js auth.js filters.js feed.js profile.js drawer.js offline.js ui.js supabase.js styles.css
server/                      index.js db.js auth.js routes/admin.js
supabase/migrations/         001_schema.sql  003_backfill_profiles.sql  004_become_business.sql
                             (000 resets an old schema, 005 removes old network tables: both optional)
scripts/                     verify-layout.mjs  check-syntax.mjs  (run with: npm run verify)
```

## 1. Supabase (once)
1. SQL Editor: run `001_schema.sql`. Then `004_become_business.sql`. If anyone signed up before the tables existed, also run `003_backfill_profiles.sql`.
2. Project Settings > API: copy the **anon public** key. Never put the `service_role` key in the browser or in Git.
3. Authentication > URL Configuration: Site URL = your Render address; Redirect URLs = that address and that address plus `/**`.
4. Authentication > Emails > SMTP Settings: add a real email service (Brevo, Resend...). The built-in sender allows only a few emails per hour.
5. Authentication > Email Templates > Magic Link: include `{{ .Token }}` so the password-reset code appears in the email.

## 2. Run locally
```bash
cp .env.example .env     # paste VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
```

## 3. GitHub
```bash
git init
git add .
git status               # .env must NOT be listed
git commit -m "WantokConnect"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git
git push -u origin main
```
`index.html` and `package.json` must be at the top of the repo, not inside a subfolder (or set Render's Root Directory to that folder).

## 4. Render (Web Service)
Build `npm install && npm run build`, start `npm start`, health check `/api/health`. Environment: `NODE_VERSION=20`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (needed at build time), `DATABASE_URL` (Supabase transaction pooler, port 6543), `ADMIN_API_TOKEN`.

## 5. Approve a storefront badge (admin)
Owners tap "Request Physical Storefront Verified" on their profile. You review their storefront photos, then:
```bash
curl -H "x-admin-token: YOUR_ADMIN_API_TOKEN" https://YOUR-APP.onrender.com/api/admin/storefronts
curl -X POST https://YOUR-APP.onrender.com/api/admin/storefront/USER_ID -H "content-type: application/json" -H "x-admin-token: YOUR_ADMIN_API_TOKEN" -d '{"status":"verified"}'
```

## Security notes
The browser holds only the anon key; Row Level Security limits every table. `.env` is git-ignored. If a secret is pushed by mistake, rotate it in Supabase right away.
