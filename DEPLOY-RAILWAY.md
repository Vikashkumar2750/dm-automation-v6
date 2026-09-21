# Deploying to Railway

This app is a TanStack Start (React 19 + Vite) full-stack app. The server build is
produced by Nitro; for Railway it is built with the `node-server` preset so it runs
as a normal Node/Bun HTTP server on `$PORT`.

## 1. What runs where

| Piece                      | Where it runs on Railway                              |
| -------------------------- | ----------------------------------------------------- |
| Frontend + server functions| One Railway service, built from `Dockerfile`          |
| Database, auth, storage    | Supabase (your existing Lovable Cloud project, or your own Supabase project) |
| Scheduled publishing       | Railway cron job hitting `/api/public/cron/publish-due` |

The app uses Supabase for auth (JWT), row-level security, and the private
`post-media` storage bucket, so keep a Supabase project in the picture. A bare
Postgres add-on is not enough on its own.

## 2. Create the service

1. Push this repository to GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Railway picks up `railway.json` and builds with the `Dockerfile`.

## 3. Variables

Copy everything from `.env.example` into the service variables. The three
`VITE_*` values must **also** be added as build arguments (Railway passes service
variables to the Docker build automatically), because they are inlined into the
browser bundle at build time.

Minimum to boot: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL`.

Feature keys: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
(Instagram/Facebook), `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (YouTube),
`LOVABLE_API_KEY` (AI assistant), `CRON_SECRET` (scheduled publishing).

## 4. Migrations

`scripts/migrate.mjs` runs on every boot. It applies each file in
`drizzle/migrations/` once, in filename order, and records it in
`public._app_migrations`. Migrations already applied by Lovable Cloud on the same
database are re-recorded harmlessly only if they are idempotent — when pointing at
an existing Lovable Cloud database, seed the tracking table first:

```sql
create table if not exists public._app_migrations (
  name text primary key, applied_at timestamptz not null default now());
insert into public._app_migrations (name)
select unnest(array['0000_init.sql', '...list your applied files...'])
on conflict do nothing;
```

To run it by hand: `DATABASE_URL=postgres://... bun run scripts/migrate.mjs`.

## 5. After the first deploy

1. Note the Railway domain, e.g. `https://app.up.railway.app`.
2. Supabase → Auth → URL configuration: set Site URL and add
   `https://<domain>/**` to the redirect allow-list.
3. Meta app → Facebook Login → Valid OAuth Redirect URIs:
   `https://<domain>/api/public/oauth/meta/callback`.
4. Meta app → each use case → Webhooks: callback
   `https://<domain>/api/public/webhooks/meta`, verify token =
   `META_WEBHOOK_VERIFY_TOKEN`.
5. Google Cloud console → OAuth client → redirect URI
   `https://<domain>/api/public/oauth/google/callback`.
6. Railway → New → Cron job, schedule `*/5 * * * *`:

   ```
   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
     https://<domain>/api/public/cron/publish-due
   ```

## 6. Local production check

```bash
NITRO_PRESET=node-server bun run build
PORT=3000 bun dist/server/index.mjs
```
