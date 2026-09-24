# Real Automation Tracing and Controlled Test Console

## Goal
Make real Instagram/Facebook comment-to-DM failures diagnosable end to end, while keeping the existing dry-run console available only where a super admin enables it.

## Evidence and repair direction
- Uploaded request logs show repeated `401` responses from `/api/public/webhooks/meta`; those requests fail Meta signature verification before any automation code runs.
- The current simulator starts after webhook verification and returns simulated success for every Meta send, so it cannot expose signature, account-mapping, gate lookup, or provider-delivery failures.
- Keep strict signature verification. Add safe diagnostics instead of bypassing it, and surface the precise failing boundary.

## Build
1. **Persistent real-event traces**
   - Add a tenant-scoped trace table for valid webhook events and automation stages.
   - Record a correlation ID, stage, outcome, safe reason code, event type, account/gate/rule/conversation references, and sanitized provider result.
   - Never store access tokens, app secrets, raw signatures, or full private payloads.
   - For pre-verification failures, emit structured server logs with correlation ID and failure reason; show their aggregate health only to super admins because the tenant is not yet trusted/known.

2. **Instrument the real pipeline**
   - Trace webhook received → signature accepted/rejected → payload parsed → account matched → event deduplicated → conversation stored → gate found → follower status checked → outbound attempt(s) → Meta accepted/rejected.
   - Capture every Meta endpoint attempt, HTTP status, provider error code/subcode, and sanitized message.
   - Keep the working follower/non-follower rules unchanged except where trace evidence identifies a concrete defect.

3. **Live trace viewer**
   - Add a live-updating timeline to Delivery Health for real comments and taps, with filters for account, outcome, and stage.
   - Clearly separate real traffic from simulator runs and show a correlation ID so one comment can be followed across all steps.
   - Add actionable labels such as “Rejected before processing: app secret mismatch” and “Tap never received from Meta.”

4. **Super-admin console control**
   - Add tenant-level test-console enable/disable and optional per-user access overrides.
   - Enforce access inside the simulation server function, not only by hiding the link/page.
   - Add controls on the super-admin workspace detail page and audit every access change.
   - Hide or block the Test Console for users without permission; super admins retain diagnostic access.

5. **Verification and delivery**
   - Add regression tests for authorization, signature rejection diagnostics, webhook/gate trace continuity, deduplication, and sanitized provider errors.
   - Run the existing automation and messaging tests plus type/build checks.
   - Push only source and migration changes to `Vikashkumar2750/railway-ready-love` `main`; exclude `.env` and credentials.
   - After Railway deploys, verify one fresh real follower and non-follower flow from the new trace timeline.
