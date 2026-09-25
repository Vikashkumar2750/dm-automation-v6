# WhatsApp Marketing Tool — Security Checklist & Plan

Target system: in-house multi-tenant WhatsApp marketing platform
(`bulkmarketing.techaasvik.in`, backend `techaasvik-backend.onrender.com/api`,
official Meta Cloud API, registered Tech Provider).

## 1. Public base URL safety
The base URL being public is acceptable — the key is the lock, not the address. But a known URL invites abuse, so:
- Rate limiting on every route (see section 4)
- API key checked on every request; reject with a plain 401, no hints
- Unknown routes return plain 404 (no stack traces, no framework banners)
- Error responses never leak internal paths, SQL, or version info
- HTTPS only + HSTS
- Put the backend behind Cloudflare (WAF, bot filtering, DDoS protection)

## 2. API keys
- Per-workspace keys (never one master key for everything)
- Store only the hash of each key in the database
- Recognisable prefix (`tak_...`) so leaks are easy to spot in logs/code
- Scopes per key: read contacts / write contacts / send campaign / admin
- Expiry dates + rotation reminders
- Instant revoke from the admin panel
- Track last-used IP and timestamp per key
- Keys only in the `X-API-Key` header — never in URLs or browser code
- Any key ever pasted in chat/email/screenshots must be rotated immediately

## 3. Endpoint hardening
- Authentication on every route (no "internal" unauthenticated routes)
- Tenant isolation: every query scoped by workspace ID, verified server-side
- Strict input validation (schema validation on all bodies/params)
- Response filtering: return only the fields the caller needs
- Correct status codes: 401 (no/bad key), 403 (no scope), 404 (unknown)
- Request size limit + JSON depth limit
- CORS locked to known origins
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Pagination limits on list endpoints (max page size)

## 4. Rate limiting
- Per key: per-minute, per-hour, per-day buckets
- Per IP: strict limit on unauthenticated requests
- Stricter limits on sensitive routes: contact export, bulk send, key creation
- Burst handling: slow down (429 + Retry-After) before hard block
- Auto-block an IP/key after repeated 401s (credential stuffing guard)
- Daily send caps per workspace (protects WhatsApp number quality rating)

## 5. Data protection
- Phone numbers encrypted at rest; masked in UI and logs
- Never log full request/response bodies
- Encrypted database backups
- DPDP/GDPR: contact delete + export on request
- Store consent proof and STOP/opt-out per contact

## 6. Monitoring & alerts
- Super admin "WhatsApp security" area in this tool's admin panel
- Live alerts for: repeated failed key attempts, key used from a new country/IP,
  rate limit hit, unusual export volume, send spike, key created/revoked,
  admin login from a new device
- Email alerts to the admin (severity levels, throttled so no spam storms)
- Security event log with CSV export

## 7. Access control
- 2FA on admin login
- Role separation: owner / admin / operator / view-only
- Session timeout
- Full audit log of admin actions

## 8. Infrastructure
- Secrets in environment variables only, never in code
- Dependency vulnerability scanning in CI
- Automatic HTTPS renewal
- Database not publicly reachable
- Separate staging and production environments
- Uptime monitoring + incident response plan

## 9. Ongoing hygiene
- Monthly: review active keys, revoke unused
- Quarterly: penetration test
- Yearly: rotate all keys
- Watch public code repos for the key prefix

## Build phases
- **S1 (immediate):** rotate the key that was partially shared; per-key rate limiting; put backend behind Cloudflare
- **S2:** key management (hashing, scopes, expiry, revoke, last-used tracking)
- **S3:** full rate-limiting layer with auto-block
- **S4:** signed security-events endpoint in this tool (`/api/public/whatsapp-security-events`) — HMAC over raw body, shared secret, timing-safe compare, timestamp window for replay protection; events stored in a new table with RLS (super admin only)
- **S5:** alert delivery — super admin Live Alerts feed + email alerts (reusing this tool's existing platform email settings)
- **S6:** data protection (encryption at rest, masking, consent/STOP records)
