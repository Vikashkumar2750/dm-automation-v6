<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Tool limits (plan DMs/month + active rules, super-admin override) stored in platform_settings.feature_flags (plans config + plan_limits_<orgId>); checked in runAutomations before new flows only — why: no schema change, never cuts mid-flow contacts.
- Public support inquiries are written only by a validated server function and read through super-admin authorization — why: anonymous visitors can contact support without exposing inquiry data.
- Unsigned webhook probes stay rejected and audited but are excluded from Breaking alerts — why: public callback scans are not Meta delivery failures.
- New automation drafts default to comment-to-DM, and deployment repairs only rules with clear comment intent that were saved as DM rules — why: prevents valid comments from being skipped without changing delivery flow.
- YouTube comment polling, AI replies, inbox sync and public replies stay isolated in YouTube modules; never route them through Meta automation — why: protects the locked Instagram/Facebook delivery flows.
- Phase A entry points (story reply/mention, ice breakers, menu) live in entry-points.* modules behind the `entry_points_enabled` flag (on unless a Super Admin switches it off) and only add an early branch to the Meta webhook — why: the locked comment/DM flows must behave identically when the flag is off.
- Phase B flows live in flows.* modules; live sending (flows-runner.server) needs both `flows_enabled` and `flows_live_enabled` (each on unless set to false), runs after keyword rules only when no rule sent, and Wait steps resume via /api/public/cron/flows — why: the locked rule engine runs first and unchanged.
- Phase C AI agent lives in ai-agent.* modules behind `ai_agent_enabled` plus a per-workspace switch, answers DMs only after rules and flows stayed silent, and reuses the flow safety gate — why: AI can never override or double-send over locked flows.
- Phase D CRM data (contact_profiles, contact_segments, contact_tags) is read/written only via crm.* modules with RLS as the user — why: CRM never touches the locked Meta delivery flow.

- Phase E revenue lives in revenue.* modules; Razorpay keys sit in a server-only table (no browser grants) per workspace and payment/coupon steps reuse the flow sending + safety path — why: creators get paid directly and the locked rule engine stays untouched.
- Phase G team tools live in team-desk.* modules; API keys (hashed) and outgoing webhooks sit in server-only tables, the public API is read-only under /api/public/v1/* with X-API-Key, and webhooks are delivered by cron from stored messages — why: integrations never hook into the locked Meta delivery flow.
- Phase H trust & safety lives in trust-safety.* modules; the audit trail is written only by DB triggers (field names, never values), and the predictive guard only sets the existing auto-pause via /api/public/cron/trust-guard — why: no change to the locked Meta delivery code.
- Phase I growth insights live in growth.* modules and are read-only (RLS as the user); competitor numbers are typed in manually — why: no extra Meta API calls and no effect on the locked delivery flow.
- Scheduler (cron) endpoints authenticate only via cronAuthFailure in src/lib/cron-secret.server.ts (constant-time, CRON_SECRET + optional CRON_SECRET_PREVIOUS) — why: one timing-safe check with rotation, no copy-pasted compares.
- OAuth tokens and Razorpay secrets are read via readToken and written via storeToken (token-crypto.server); TOKEN_ENCRYPTION_KEY turns on AES-GCM and /api/public/cron/encrypt-tokens seals legacy rows — why: one switch encrypts at rest without breaking existing connections.
