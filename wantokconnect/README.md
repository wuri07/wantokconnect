# WantokConnect Market

A mobile-first marketplace for small businesses, service providers and customers in Papua New Guinea. Dark theme (black, neon red, gold), email login, filters by region / province / category, posts with photos and files, live In Stock / Out of Stock, WhatsApp arrangement, notifications, messages and feedback.

**Stack:** Vite (vanilla JS) front end, Supabase (Postgres, Auth, Storage, Realtime) for data, and a Node/Express server that serves the built site and the API.

```
index.html                   Vite entry point (must be at the TOP of the repo)
package.json                 scripts: build (vite build), start (node server/index.js)
vite.config.js  render.yaml  .env.example  .gitignore
public/                      sw.js (offline app shell), manifest.webmanifest, icon.svg
src/                         main.js (boot + routing) auth.js feed.js filters.js profile.js drawer.js
                             network.js directory.js verify.js   <- professional network, business directory, verification
                             api.js offline.js ui.js supabase.js styles.css
server/                      index.js (serves dist/ + /api)  db.js  auth.js
  routes/                    network.js directory.js verification.js sync.js admin.js
supabase/migrations/         001_schema.sql  002_network_verification.sql
scripts/                     verify-layout.mjs (runs before every build)  check-syntax.mjs
```

## API (all need `Authorization: Bearer <Supabase token>` except health and admin)
| Route | Purpose |
|---|---|
| `GET /api/health` | Health check for Render |
| `GET /api/network/feed?hub=&province=&type=` | Structured professional feed, ranked by Vouched / Resourceful |
| `POST /api/network/posts` | Post a job, service, question, news or achievement (hub required) |
| `POST /api/network/posts/:id/react` | Vouched / Resourceful on or off |
| `POST /api/network/connect/:userId` | Connect or disconnect |
| `GET` / `PUT /api/network/profile/:id` | Headline, hub, bio, skills |
| `GET /api/directory?q=&region=&province=&category=` | Small business directory |
| `GET /api/verification/status`, `POST /national-id`, `POST /storefront` | Verification requests |
| `POST /api/sync` | Replays actions queued while offline (safe to repeat) |
| `GET/POST /api/admin/...` | Review and approve verifications (header `x-admin-token`) |

## Fixing "Could not resolve entry module index.html" on Render
Vite looks for `index.html` in the folder where `npm run build` runs. If your GitHub repo contains a folder (for example `wantokconnect/`) that holds the project, either move everything up so `index.html` and `package.json` are at the top, or set Render > Settings > **Root Directory** to that folder. Run `npm run verify` on your computer to check this: it tells you exactly what is missing.

## 1. Set up Supabase (once)
1. Open your project: https://rgoxjeqjoomgrqiomduv.supabase.co (dashboard: supabase.com/dashboard).
2. **SQL Editor > New query**: paste `supabase/migrations/001_schema.sql` and press **Run**, then do the same with `002_network_verification.sql`. Run each once, in that order.
3. **Project Settings > API**: copy the **anon public** key. Never use or share the `service_role` key in the browser or in Git.
4. **Authentication > Providers > Email**: keep Email enabled. Keep "Confirm email" on for production.
5. **Authentication > Email Templates**: the password-recovery code is sent with the **Magic Link** template (and signup uses **Confirm signup**). Edit **Magic Link** so the body shows the code, for example:
   `Your WantokConnect code is: {{ .Token }}`
6. **Authentication > URL Configuration**: set **Site URL** to your Render address (add `http://localhost:5173` under Redirect URLs for local testing).
7. **Authentication > SMTP Settings**: add a real SMTP provider (Resend, Brevo, SendGrid...). Supabase's built-in email sender is limited to a few emails per hour and will block real users.
8. **Database > Replication**: `sme_products`, `notifications` and `direct_messages` should show as enabled (the SQL does this).

## 2. Run locally
```bash
cp .env.example .env        # then edit .env: paste VITE_SUPABASE_ANON_KEY
npm install
npm run dev                 # http://localhost:5173
```
Production style: `npm run build && npm start` then open http://localhost:5173.

## 3. Push to GitHub
Create an **empty** repository on github.com (no README, no .gitignore), then from this folder:
```bash
git init
git add .
git status                  # check that .env is NOT listed (only .env.example)
git commit -m "Initial commit: WantokConnect SME marketplace"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/wantokconnect.git
git push -u origin main
```
If Git asks for a password, use a Personal Access Token (GitHub > Settings > Developer settings > Tokens) or run `gh auth login` first.

## 4. Deploy on Render
1. render.com > **New > Blueprint** > connect the GitHub repo (it reads `render.yaml`). Or **New > Web Service** with build `npm install && npm run build`, start `npm start`.
2. Set environment variables: `VITE_SUPABASE_ANON_KEY` (the anon key), `DATABASE_URL` (Supabase **Connect > Transaction pooler** string, port 6543, with your database password). `VITE_SUPABASE_URL`, `ADMIN_API_TOKEN` and `ID_PEPPER` are filled in by the blueprint. Keep `ID_PEPPER` safe: changing it later breaks existing ID checks.
3. Deploy. Add the final `https://....onrender.com` address to Supabase **Site URL** (step 6 above).
4. The free Render plan sleeps after inactivity, so the first visit can take about 50 seconds.

## 5. Review verifications (admin)
List pending requests: `curl -H "x-admin-token: YOUR_ADMIN_API_TOKEN" https://YOUR-APP.onrender.com/api/admin/verifications`. Approve a National ID with `POST /api/admin/national-id/USER_ID`. Storefronts:
Business owners tap "Request Physical Storefront Verified". After you review their storefront photos:
```bash
curl -X POST https://YOUR-APP.onrender.com/api/admin/storefront/USER_ID \
  -H "content-type: application/json" -H "x-admin-token: YOUR_ADMIN_API_TOKEN" -d '{"status":"verified"}'
```
`USER_ID` is the owner's id in Supabase > Table Editor > users.

## 6. Test checklist
Sign up as a business owner (email, password, name) > profile: add a location > go to the feed and post with two photos and a PDF > see it in your catalog > flip In Stock off. In a second browser sign up as a customer, tap Connect on that business: you get a notification, tap it to jump to the post, and the stock badge changes live. Try Forgot password: code email > verify > new password.

## Security notes
- The browser only holds the anon key. Row Level Security limits every table: people can edit only their own rows, only business owners can post, messages are private, and verification status can only be changed by the server.
- `.env` is git-ignored. If a secret is ever pushed by mistake, rotate it in Supabase (database password and keys) right away.
