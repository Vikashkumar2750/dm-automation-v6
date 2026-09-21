# Deploying to Railway

This app is a TanStack Start (React 19 + Vite) full-stack app. The server build is
produced by Nitro; for Railway it is built with the `node-server` preset so it runs
as a normal Node/Bun HTTP server on `$PORT`.

Verified before release: production build (`NITRO_PRESET=node-server bun run build`)
succeeds and the built server serves `/` and `/auth` with HTTP 200.

## 1. What runs where

| Piece                       | Where it runs on Railway                                |
| --------------------------- | ------------------------------------------------------- |
| Frontend + server functions | One Railway service, built from `Dockerfile`             |
| Database, auth, storage     | Supabase (your Lovable Cloud project, or your own)       |
| Scheduled publishing        | Railway cron job hitting `/api/public/cron/publish-due`  |

The app uses Supabase for auth (JWT), row-level security, and the private
`post-media` storage bucket, so keep a Supabase project in the picture. A bare
Postgres add-on is not enough on its own.

## 2. Create the service

1. Push this repository to GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Railway picks up `railway.json` and builds with the `Dockerfile`.

## 3. Variables

Copy everything from `.env.example` into the service variables. The three
`VITE_*` values must **also** be available at build time (Railway passes service
variables to the Docker build automatically), because they are inlined into the
browser bundle.

Minimum to boot: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.

Feature keys: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
(Instagram/Facebook), `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
(YouTube), `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (plans; test keys stay in
demo mode and charge nothing), `LOVABLE_API_KEY` (AI assistant), `CRON_SECRET`
(scheduled publishing).

## 4. Migrations

`scripts/migrate.mjs` runs on every boot. It applies each file in
`drizzle/migrations/` once, in filename order, and records it in
`public._app_migrations`. When pointing at an existing Lovable Cloud database
where those migrations already ran, seed the tracking table first so nothing is
re-applied:

```sql
create table if not exists public._app_migrations (
  name text primary key, applied_at timestamptz not null default now());
insert into public._app_migrations (name)
select unnest(array[
  '0000_multi_tenant_core.sql','0001_org_owner_select_policy.sql',
  '0002_social_accounts_core.sql','0003_webhook_events.sql',
  '0004_automation_rules.sql','0005_automation_safety_and_variations.sql',
  '0006_automation_quota_and_viral_guard.sql','0007_create_posts.sql',
  '0008_team_invitations.sql','0009_posts_multi_platform_media.sql',
  '0010_post_media_storage_policies.sql','0011_seed_first_super_admin.sql',
  '0012_fix_super_admin_owner.sql','0013_grant_super_admin_to_owner_email.sql',
  '0014_grant_super_admin_techaasvik_contact.sql','0015_agency_white_label_branding.sql',
  '0016_platform_ops_console.sql','0017_harden_platform_security.sql',
  '0018_razorpay_plan_orders.sql','0019_private_security_definer_helpers.sql'])
on conflict do nothing;
```

To run it by hand: `DATABASE_URL=postgres://... bun run scripts/migrate.mjs`.

## 5. After the first deploy

1. Note the Railway domain, e.g. `https://app.up.railway.app` (or your custom
   domain, `https://contentengineer.techaasvik.in`).
2. Supabase → Auth → URL configuration: set Site URL and add
   `https://<domain>/**` to the redirect allow-list.
3. Meta app → Facebook Login → Valid OAuth Redirect URIs:
   `https://<domain>/api/public/oauth/meta/callback`.
4. Meta app → each use case → Webhooks: callback
   `https://<domain>/api/public/webhooks/meta`, verify token =
   `META_WEBHOOK_VERIFY_TOKEN`.
5. Google Cloud console → OAuth client:
   - Authorized JavaScript origin: `https://<domain>`
   - Authorized redirect URI: `https://<domain>/api/public/oauth/google/callback`
6. Razorpay: swap the test keys for live keys when you want real charges.
7. Railway → New → Cron job, schedule `*/5 * * * *`:

   ```
   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
     https://<domain>/api/public/cron/publish-due
   ```

## 6. Local production check

```bash
NITRO_PRESET=node-server bun run build
PORT=3000 bun dist/server/index.mjs
```

## 7. Known gaps

- YouTube: connecting a channel works; uploading videos to YouTube is not
  implemented yet (Instagram and Facebook publishing are).
- The Meta app must be moved out of development mode before real client
  accounts can connect.
