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
- PostPicker shares poster resolution/error fallback to prevent broken media.
- Legal page and delivery popup share DisclaimerContent for consistent text.
- Workflows requires feature_flags.workflows_enabled via getPlatformStatus — Super Admin controls rollout.
- Read subdirectory AGENTS.md before edits.
- Safety send caps are per connected account (account-safety.server), clamped to feature_flags safety_caps[_<orgId>]; plan quota is workspace-wide — Meta flags accounts, billing is per workspace.
- public.relink_conversation_accounts re-links chats after disconnect/reconnect (on deploy + each connect) — keeps account filters complete without touching Meta delivery.
- Workspace entitlements derive active root Agency benefits through workspace-entitlements.* after child membership verification; inherited grants use plan_source agency_parent and never outlive the parent — keeps client labels, branding, connection caps and quotas consistent without sharing workspace data.
- Revenue products separate private delivery_url from external payment manual_url; checkoutAmount is shared by public price and checkout, and buyer-access resolves content only for confirmed paid workspace purchases — prevents price drift and unpaid content access.
- Publishing tab visibility uses boolean feature_flags resolved through publishing-availability; PublishingPageGate covers list, calendar and new-post pages before mounting their content, while scheduled jobs and Meta automation remain unchanged — rollout controls must not cancel existing work.
- Dashboard overview reuses workspace-scoped queries and useWorkspaceFeatures for shortcuts; only real source metrics are shown — presentation changes must not add delivery calls or invent business counts.
- Dashboard setup derives milestones from confirmed source reads; sales reuses the Revenue query and explicitly separates its fixed event window from the capped lead sample — prevents invented completion or misleading totals.
- Item links carry a workspace ID and validated item ID; resolve only against active-workspace reads and never auto-switch workspaces — prevents stale search links from selecting another tenant's chat or post.
- Admin overview derives priorities from its existing protected overview read, labels event samples explicitly, and keeps unsigned probes separate from verified delivery failures — no new delivery calls or misleading health totals.
- Admin workspace tabs mount on first visit and stay mounted while inactive; key the detail view by workspace ID — preserves unsaved controls without loading every panel on entry or leaking drafts across tenants.
