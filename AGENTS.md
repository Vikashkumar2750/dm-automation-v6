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
- Tool limits and admin overrides live in platform_settings.feature_flags (plans + plan_limits_<orgId>); runAutomations checks before new flows only — no schema change, never cuts mid-flow contacts.
- Public support uses validated writes and super-admin-only reads — anonymous visitors can contact support without exposing inquiry data.
- Unsigned webhook probes stay rejected and audited but are excluded from Breaking alerts — public callback scans are not Meta delivery failures.
- New automation drafts default to comment-to-DM, and deployment repairs only rules with clear comment intent that were saved as DM rules — prevents valid comments from being skipped without changing delivery flow.
- YouTube comment polling, AI replies, inbox sync and public replies stay isolated in YouTube modules; never route them through Meta automation — protects the locked Instagram/Facebook delivery flows.
- Phase A entry points (story reply/mention, ice breakers, menu) live in entry-points.* modules behind the `entry_points_enabled` flag (on unless a Super Admin switches it off) and only add an early branch to the Meta webhook — the locked comment/DM flows must behave identically when the flag is off.
- Phase B flows live in flows.* modules; live sending (flows-runner.server) needs both `flows_enabled` and `flows_live_enabled` (each on unless set to false), runs after keyword rules only when no rule sent, and Wait steps resume via /api/public/cron/flows — the locked rule engine runs first and unchanged.
- Phase C AI agent lives in ai-agent.* modules behind `ai_agent_enabled` plus a per-workspace switch, answers DMs only after rules and flows stayed silent, and reuses the flow safety gate — AI can never override or double-send over locked flows.
- CRM uses crm.* and user RLS; growth.* is read-only with manual competitor numbers — neither touches Meta delivery or adds Meta calls.
- Phase E revenue lives in revenue.* modules; Razorpay keys sit in a server-only table (no browser grants) per workspace and payment/coupon steps reuse the flow sending + safety path — creators get paid directly and the locked rule engine stays untouched.
- Buyer offers resolve unguessable tokens server-side; private delivery images require active page references — public sales pages must not expose customer identity, payment credentials, or unrelated workspace media.
- Phase G team tools live in team-desk.* modules; API keys (hashed) and outgoing webhooks sit in server-only tables, the public API is read-only under /api/public/v1/* with X-API-Key, and webhooks are delivered by cron from stored messages — integrations never hook into the locked Meta delivery flow.
- Phase H trust & safety lives in trust-safety.* modules; the audit trail is written only by DB triggers (field names, never values), and the predictive guard only sets the existing auto-pause via /api/public/cron/trust-guard — no change to the locked Meta delivery code.
- PageReadyGate waits for first data; sessions share one store, guards cache admin answers and links preload on hover — no placeholders or re-hidden cached pages.
- Usage counts distinct run_key via count_org_runs. Activity retains run_key entries; activity-journeys groups rule/conversation callbacks between fresh triggers before filtering — why: one journey border pair without delivery changes or mixing contacts.
- Flow post targeting lives on Flow.targetPostIds (empty = all posts), checked by flowTargetsPost in runLiveFlows; the post picker is shared in components/app/PostPicker — same matching rule as keyword rules, no change to the rule engine.

- Manual moderation uses stored workspace conversation/message IDs, role checks and Meta-first writes; only Facebook Page-authored public replies can be edited — prevents unauthorized targets and unsupported edit claims.
- Constrain mobile shells/panels/dialogs; tables/canvases scroll locally. Inbox chat spans heading/list grid rows for full height without page scroll.
- Notifications reuse workspace-scoped run reads in one AppShell provider; read IDs are local per user/workspace — consistent bell/banner without delivery changes.
- PostPicker shares poster resolution/error fallback — prevents broken media.
- Workflows page shows only when feature_flags.workflows_enabled is true (getPlatformStatus) — why: Super Admin controls rollout.
- Subdirectories (e.g. src/lib) have their own AGENTS.md — read before changing files there.
- Safety send caps (hourly/daily/journeys-per-contact) are per connected account via account-safety.server, clamped to Super Admin max values in feature_flags (safety_caps / safety_caps_<orgId>); plan quota stays workspace-wide — Meta flags accounts individually, billing is per workspace.
