# WhatsApp tool security checklist — document plan

Create `docs/WHATSAPP-TOOL-SECURITY.md` — a complete security checklist for the in-house WhatsApp marketing platform (`bulkmarketing.techaasvik.in`, backend `techaasvik-backend.onrender.com/api`), plus the alerting and rate-limiting work needed on this side.

Nothing in the app changes with this step — it is a written document. Build items marked "to build here" come later, after you approve them.

## 1. The public base URL — is it a risk?

Section explains in plain language:

- Knowing the address alone is not a breach. Every API address eventually becomes known. The key is the lock, not the address.
- What a known address does enable: traffic floods, endpoint guessing, and instant use of any leaked key.
- How to make a public URL safe: every route requires a key, unknown routes return a plain 404, error messages never reveal internals, no directory listing, no stack traces, HTTPS only with HSTS, and a WAF/proxy (Cloudflare) in front so the origin is never hit directly.
- Optional hardening: allow-list the caller IPs that are allowed to use a key, and put admin-only routes on a separate hostname.

## 2. API keys

- One key per workspace/client, never one master key.
- Store only a hash of the key in the database; show the raw value once at creation.
- Prefix keys so they are recognisable and scannable in leaks (`tak_...` already does this).
- Scopes per key: read contacts, write contacts, send campaign, admin — separate.
- Expiry date and forced rotation reminder.
- Instant revoke button, and "revoke all keys for this client".
- Last-used timestamp, last-used IP, and usage count on every key.
- Never in the browser, never in a repo, never in a URL query string — header only.
- Immediate action: rotate the key that was pasted into this chat.

## 3. Endpoint hardening

- Authentication check on every route by default; a route is private unless explicitly marked public.
- Authorisation: the key's workspace must own the record being read or written (no ID-guessing across tenants).
- Input validation on every field, with length and type limits.
- Response filtering: never return more columns than needed, never return other tenants' data.
- Consistent errors: 401 for bad key, 403 for wrong scope, 404 for everything unknown — no hints.
- Request size limit and JSON depth limit.
- Disable any debug or test routes in production.
- CORS locked to your own domains, not `*`.
- Security headers: HSTS, no-sniff, frame-deny, referrer policy.
- Pagination limits so one call cannot dump the entire contact database.

## 4. Rate limiting and abuse control

- Per key: requests per minute, per hour, per day.
- Per IP limit for unauthenticated hits, so guessing attempts get cut off fast.
- Stricter limit on sensitive routes: contact export, bulk send, key creation, login.
- Burst protection plus a slow-down (each repeated request gets slower) before an outright block.
- Auto-block an IP after repeated 401s.
- Daily send caps per workspace, matching WhatsApp's own limits.
- Return `429` with a retry-after header rather than silently dropping.

## 5. Data protection

- Encrypt phone numbers and tokens at rest.
- Mask phone numbers in the interface and in logs (`+91 98XXXX XX10`).
- Never log full request bodies containing personal data or keys.
- Backups encrypted, with a tested restore.
- Data delete and export per contact (DPDP/GDPR).
- Consent and opt-out records kept, with proof of when STOP was honoured.

## 6. Monitoring, alerts and notifications (to build here)

Super admin console gets a "WhatsApp security" area, fed by events from the WhatsApp backend:

- Live alert in the admin console for: repeated failed key attempts, a key used from a new country or IP, rate limit hit, unusual contact export volume, sudden send spike, key created or revoked, admin login from a new device.
- Same alerts by email to the admin address already configured in platform settings, with severity levels (critical sends immediately, low severity batches into a daily digest).
- Alert throttling so one incident does not send a hundred emails.
- A security event log page with filters and CSV export.
- Optional: WhatsApp or Telegram alert to the owner for critical events only.

## 7. Access control for the WhatsApp tool

- Two-factor authentication for every admin login.
- Role separation: owner, admin, operator, view-only.
- Session timeout and forced re-login for sensitive actions.
- Audit log of every admin action with who, what, when, and from where.
- Remove access immediately when a team member leaves.

## 8. Infrastructure

- Secrets in the host's environment variables, never in code or the repo.
- Dependency vulnerability scan on every deploy.
- Automatic HTTPS certificate renewal.
- Database not reachable from the public internet.
- Separate staging and production credentials.
- Uptime monitoring with an alert when the backend goes down.
- A one-page incident plan: who to call, how to revoke everything, how to notify affected clients.

## 9. Ongoing checks

- Monthly: review active keys, remove unused ones.
- Quarterly: penetration test or at minimum an automated scan.
- Yearly: full access review and credential rotation.
- Watch for your key prefix appearing in public code search.

## Build phases (after the document)

1. **Phase S1 — Immediate** (no code): rotate the exposed key, confirm per-key rate limiting exists, confirm every route requires a key, put Cloudflare in front.
2. **Phase S2 — Key management**: per-workspace keys, hashing, scopes, expiry, revoke, last-used tracking.
3. **Phase S3 — Rate limiting and abuse blocking** on the WhatsApp backend.
4. **Phase S4 — Security events into this app**: a signed endpoint here that the WhatsApp backend posts events to, stored and shown in the super admin console.
5. **Phase S5 — Alerts**: live alerts panel, email alerts with severity and throttling, CSV export.
6. **Phase S6 — Data protection and compliance**: masking, encryption, consent log, export/delete.

## Technical notes

- The events endpoint on this side goes at `src/routes/api/public/whatsapp-security-events`, protected by an HMAC signature over the raw body with a shared secret, timing-safe compared, with a timestamp window to block replays. Events stored in a new table with RLS, readable by super admin only.
- Email alerts reuse the existing platform email settings (sender name, admin alert email, event switches) so there is one place to control them.
- Alerts appear in the existing Live Alerts feed rather than a separate system.
- No change to Instagram/Facebook DM automation — it is untouched by this work.
