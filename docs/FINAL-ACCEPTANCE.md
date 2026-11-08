# AutoDM: one remaining acceptance batch

## Implementation-first status

Owner has deferred all live acceptance. No new screenshots, payments, keys, messages or receiver setup are requested now. Team Desk/API authorization and shared Team Desk/CRM webhook destination protection are implemented. Webhooks resolve through Cloudflare's public HTTPS DNS resolver (hostname queries only, no contact payload), reject non-global/mixed addresses, and connect directly to the approved IP with original TLS identity/Host. Redirects are never followed. DNS/transport failures fail closed; no unpinned fallback. This new transport still needs deployed receipt/retry acceptance when testing resumes.

**Remaining, not code defects:** latest deployment; deferred acceptance below; optional external legacy-schedule inspection; verified-domain sender-address configuration confirmation; owner/provider reviews; disposable restore database and private storage-file export. Do not restore production or create paid resources. Password/provider rotation and other previously deferred areas remain deferred.

## Confirmed — do not repeat

- Hosting: owner confirms CRON_SECRET and TOKEN_ENCRYPTION_KEY configured.
- Encryption: live screenshot reports zero primary and secondary plaintext values in social tokens and payment credentials. NULL values are not counted; this is not a credential-validity test. Preserve the current encryption key.
- Scheduler: eight jobs returned 200, no consecutive failures at the supplied capture time.
- Revenue refresh and commented SQL results work.
- Sender domain autodm.techaasvik.com is Verified; test receipt is Delivered. This does not establish auth/password-reset email configuration or live payment settlement.
- Test payment, buyer library and private file download confirmed earlier.
- Full database dump download works. It does not include uploaded file bytes.

## 1. Owner hosting/security batch

1. Owner confirms the previous Railway deployment is complete. New shared webhook destination safeguards from this batch still need deployment. Do not create another scheduler.
2. Confirm RESEND_FROM_EMAIL belongs to the verified domain; no secret values need sharing.
3. Connected managed backend schedule inventory is empty; this does not inspect the separate live database or Railway services. Existing app scheduler excludes db-backup, and its retired authenticated endpoint returns 410 without exporting data. Optional cleanup: Railway project → each service → Settings → Cron Schedule; remove only a dedicated old backup caller, never the main app/current scheduler. If unsure, provide a redacted service-list/settings screenshot, not raw commands or headers. Live database cron inventory can be checked with the read-only metadata query in `docs/sql/railway-legacy-backup-check.sql`.
4. Password/provider credential rotation is deferred by the owner, not completed. When resumed, rotate in issuing services and corresponding live settings, then verify connections. Preserve TOKEN_ENCRYPTION_KEY; replacing it makes existing encrypted credentials unreadable.
5. Existing Revenue/Team Desk repairs are confirmed. Do not apply more schema repairs without a specific missing-table/column error. If another feature fails, supply only its error, not stored tokens or customer records.

## 2. Live app checks — one disposable workspace

Use non-customer test data and restore settings afterward. Refresh after each save to confirm persistence.

| Area | Check | Expected result |
| --- | --- | --- |
| Team Desk | Assign a test conversation, reload, then restore its previous assignment. | Saved assignment survives reload, stays in its workspace. |
| Approvals | An agent submits a harmless test draft; reviewer rejects it. | Rejected status persists; no message sends. Approve-and-send requires a fresh authorized Meta thread. |
| Admin drafts | Change an unsaved text field, switch tabs, return, then discard. | Draft remains during tab switches; does not cross workspaces. |
| Admin CSV | Apply a directory filter, export CSV, compare to visible rows. | Only filtered/sorted authorized rows; formula-like text is escaped. Keep exported identities private. |
| Publishing controls | Record existing switches; check Hidden and Coming soon on a disposable workspace/customer session, then restore. | Correct navigation/direct-page state; do not retry publishing jobs. |
| Agency | Open an existing client workspace; check inherited active benefits and billing restriction. | Parent benefits apply only while active; client cannot pay separately. New provider connection needs owner authorization. |
| Unpaid buyer | Sign in to an unpaid test buyer through the purchase portal without paying. | No private download appears; attempts to resolve another buyer/workspace purchase are denied. Do not reuse paid buyer sessions as the unpaid check. |

## 3. API and webhook receiver batch

Use a receiver you control, not a public request-logging service: webhook payloads contain contact/message data.

- Team Desk → API & webhooks: create a temporary test key. Keep it out of chat/screenshots/logs.
- Request `/api/public/v1/conversations` from a trusted local API client with the X-API-Key header. Confirm only that workspace's data; missing/invalid/revoked key must fail. Revoke the key afterward.
- Register an owner-controlled HTTPS receiver and select the test message event. Keep its signing secret private.
- With one authorized new test message, verify receiver body, timestamp and HMAC signature. A receiver returning 500 should retain the batch for retry; returning 2xx should advance it. Duplicate delivery can occur when the receiver accepts but status persistence fails: deduplicate by message ID.
- Disable/remove the test webhook afterward. Never test retry by creating a permanent failure loop.
- Shared destination protection now covers Team Desk and CRM webhooks at save and delivery, rejects private/reserved/mixed DNS results, pins the HTTPS connection and never follows redirects. Verify deployed TLS delivery and retry when live acceptance resumes; use only a receiver you control.

## 4. Meta checks requiring owner interaction

- Use a disposable test post/comment and two owner-controlled identities: existing follower and non-follower.
- Trigger the authorized rule, tap its original follow button, and verify one expected response. Confirm the fresh event in Activity and notification bell.
- Test hide/delete on a disposable supported comment; verify in Meta itself. Edit only supported Facebook Page-authored public replies.
- Verify account-cap logic with existing automated tests; do not flood users to hit production limits. A controlled live boundary test needs explicit low-volume targets/settings and restoration afterward.
- Publishing retries remain skipped until instagram_content_publish approval. Provider review approval cannot be completed inside the app.

## 5. Recovery prerequisites

Google Drive is now linked and its read-only app credential check passed. Manual
and 6/12/24-hour archive controls are implemented for the independent Railway
backend; deployment, secure connector credential distribution, explicit
DRIVE_BACKUP_DATABASE_URL setup and first upload remain pending. See
DEPLOY-RAILWAY.md. No database contents have been uploaded in this session.
The archive gets a full pg_restore readability check and uploaded-size check,
which are useful alternatives before a restore rehearsal, not proof of recovery.

The owner does not currently know whether a receiver or disposable restore database exists. Neither is assumed available. Do not add a public request logger or create a paid database without explicit approval.

- Provide a separate empty, disposable database through secure hosting controls, never in chat. Restore the private full dump there, check tables/data/policies/functions and a separate test sign-in. Never point production at it during rehearsal.
- Export private uploaded file bytes separately through the live storage provider's authorized controls. Keep object paths/manifests private and test one restored object alongside its database reference. A SQL dump alone cannot recover files.
- No safe supported copied-migration reset is available. Do not delete journals or production data to force one.

## Deferred by owner

Password/provider credential rotation, payment-popup handoff screenshot/payment, publishing until approval, YouTube/unlinked chat and invitation acceptance. These are not counted as completed or repeatedly requested now. Drive implementation is complete; its external deployment and first upload are pending.

When the owner resumes testing, collect one batch of redacted pass/fail outcomes for sections 1–4 and confirm recovery prerequisites. Until then, live acceptance is deferred, not complete. No passwords, keys, raw API responses or customer exports are needed.