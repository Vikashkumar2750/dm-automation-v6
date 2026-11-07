# Deploying to Railway

This app is a TanStack Start (React 19 + Vite) full-stack app. The server build is
produced by Nitro; for Railway it is built with the `node-server` preset so it runs
as a normal Node/Bun HTTP server on `$PORT`.

The repository contains Railway deployment configuration. A successful local
check does not establish the current Railway deployment, provider configuration,
or signed-in acceptance status.

## 1. What runs where

| Piece                       | Where it runs on Railway                                |
| --------------------------- | ------------------------------------------------------- |
| Frontend + server functions | One Railway service, built from `Dockerfile`             |
| Database, auth, storage     | An independently managed compatible backend             |
| Scheduled jobs             | `scripts/scheduler.mjs` in the same Railway service       |

The app requires auth, row-level security and private storage, not just a bare
Postgres add-on. Lovable Cloud does not expose its service-role key or database
password. Do not try to extract managed credentials for Railway: remain on Cloud,
or provision an independently managed backend and plan a separate data migration.
The env template is for that independent deployment, not the current Cloud app.

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
(scheduled jobs). The included start command already launches the scheduler;
do not add a second scheduler or duplicate cron job.

Also configure `PUBLIC_APP_URL` to the public HTTPS origin. Set
`INSTAGRAM_APP_SECRET` when Instagram Login uses a separate app secret.

For encrypted connected-account tokens and workspace payment credentials, set
`TOKEN_ENCRYPTION_KEY` to base64 encoding of exactly 32 cryptographically random
bytes. Generate and store it privately in the hosting secret controls. Preserve
the same key across redeploys; losing or replacing it prevents existing sealed
tokens from being read. Verify the authenticated `encrypt-tokens` scheduled job
backfills legacy values; never expose the key or manually print stored tokens.

For buyer receipt/access and support emails on Railway, set `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` to an address on your verified sender domain. The default
testing sender is not proof of production email readiness. Auth confirmation and
password-reset emails require separate auth email-provider configuration.

## 4. Migrations

`scripts/migrate.mjs` runs on boot and tracks SQL filenames in
`public._app_migrations`. The current checked-in SQL inventory is
`0000_product_files_policies.sql`; this is **not a complete application schema
history**. The runner cannot build every feature table for a fresh backend.

The live Growth failure was reproduced as a missing `growth_competitors` table.
`docs/sql/railway-growth-repair.sql` is a proposed additive repair for that
independently hosted backend, with grants and workspace-role policies. Have an
authorized database operator apply it through the live backend's approved
migration workflow after a backup; then rerun Growth as the affected account.
It has not been applied to Railway. The preview already has this table, so a
preview migration cannot repair the separate live backend.

Before pointing Railway at a fresh database, compare the complete schema export
and an approved bootstrap against current application requirements. Verify every
required table, function, grant, policy and private bucket before releasing.
For an existing database, reconcile actual applied files with tracking records;
never seed historical filenames that are absent or unverified.

The runner can skip when `DATABASE_URL` is missing or invalid. A running web
server therefore does not prove migrations succeeded. Check startup logs and the
actual schema. Do not delete Drizzle journals/snapshots or reset a live database
to bypass a mismatch. The copied-history reset still needs a supported workflow.

## 5. After the first deploy

1. Note the Railway domain, e.g. `https://app.up.railway.app` (or your custom
   domain, `https://contentengineer.techaasvik.in`).
2. Configure the independent backend's auth Site URL and same-origin redirect
   allow-list for the deployed domain; keep email confirmation enabled.
3. Meta app → Facebook Login → Valid OAuth Redirect URIs:
   `https://<domain>/api/public/oauth/meta/callback`.
4. Meta app → each use case → Webhooks: callback
   `https://<domain>/api/public/webhooks/meta`, verify token =
   `META_WEBHOOK_VERIFY_TOKEN`.
5. Google Cloud console → OAuth client:
   - Authorized JavaScript origin: `https://<domain>`
   - Authorized redirect URI: `https://<domain>/api/public/oauth/google/callback`
6. Razorpay: swap the test keys for live keys when you want real charges.
7. Confirm the included scheduler starts once and its health/heartbeat reads
   succeed. Keep a stable private `CRON_SECRET`; the startup fallback does not
   replace intentional secret configuration.

## 6. Local production check

```bash
NITRO_PRESET=node-server bun run build
PORT=3000 bun dist/server/index.mjs
```

## 7. Release acceptance still required

- Sign in as the affected customer and authorized Super Admin; verify Growth,
  navigation, desktop/mobile views, settings drafts, account filters and exports.
- Verify Meta comment → DM → follow buttons for followers/non-followers, native
  moderation changes, publishing and Agency account access on actual accounts.
- YouTube publishing is implemented; provider approval and live upload/comment
  verification are separate release checks, not established by source code.
- Authorize a payment test, then verify paid return, one receipt/access email,
  private signed download and unpaid-access denial. Do not make live charges
  without approval.
- Complete Meta/Google app reviews and production account permissions.
- Verify encryption backfill, sender delivery and scheduled jobs after deployment.

Track evidence and blockers in `roadmap.md`; implemented is not the same as
live-verified.

## Database Backups (Super Admin → Database Backups)
The legacy custom dump, import, SQL runner and backup cron are retired. Remove any
scheduler calling `/api/public/cron/db-backup`; authenticated calls return 410.
Do not re-run the old backup setup scripts to re-enable these endpoints.

For Lovable Cloud, use More → Database → Manage → Settings → Export data.
Daily snapshots are under More → Database → Manage → Backups; they restore schema
and data in place. Export first: later writes are lost and the schema also reverts.
Neither snapshots nor exports include storage files; download those separately.
For an independently hosted database, use its owner's supported backup tools.
Existing custom SQL files are data-only copies, not complete recoverable backups.
Google Drive automated backup integration remains unconfigured.

Inbox relink result `chats_still_unlinked = 1` is a remaining account association,
not an execution error. Run the read-only `docs/sql/railway-inbox-diagnostic.sql`
on that same live database and confirm the original account; never guess or delete
historical conversations to make the count zero.
