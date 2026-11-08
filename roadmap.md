# DM FB-IG-YT by Techaasvik — Build Roadmap

## Consolidated remaining checklist — Nov 8, 06:12 UTC
- [x] Nov 8 continuation: owner's screenshot confirms deployed Team members tab with owner and invitation controls. Reports/integrations no longer depend on shared-inbox reads; their own failures remain visible. Invitation submission and other tabs are not verified by this screenshot.
- [x] Re-ran all regression tests: 425 tests across 70 files pass. Browser checks of Dashboard, Team, Team Desk and Database Backups redirect to sign-in with no page errors. These are access checks, not authenticated acceptance.
- [x] Full dump export confirmed working by the owner; Google Drive explicitly deferred. Growth repair confirmed installed and loading; it is no longer a pending repair.
- [x] Owner's Nov 8 screenshots confirm live invoice read/save: ₹500 ARTH invoice marked paid; ₹200 Vikas Dhiman invoice added, returned as unpaid, and totals show ₹200 due/₹500 marked paid. This is manual invoice bookkeeping, not verified payment settlement.
- [ ] Shared inbox, Approvals and API/webhooks live checks — invoice success does not establish installation of their five schema sources after independent-tab changes.
- [ ] Latest merged Team members, invites/workspace switching, Dashboard/bell, remaining admin drafts/exports/publishing selectors and cross-account/Agency/mobile acceptance — authorized current-release session needed. Self-session mint failed because no requesting-user account matches this preview backend.
- [ ] Meta/YouTube delivery, follower taps, moderation, publishing, fresh notifications and active safety — disposable approved post/chat targets and connected provider authorization needed.
- [ ] Payment → receipt/email → private download and unpaid live denial — approved product, amount, recipient and verified sender needed; automated authorization tests pass, no real charge attempted.
- [ ] Hosting secrets/credential rotation, live encryption backfill and scheduler verification, external legacy backup job removal and older live schema prerequisites — Railway configuration/job-list/database access needed; do not substitute connected Cloud changes.
- [ ] Copied migration reset — supported safe reset unavailable; no migration journals or production data deleted.
- [ ] Full restore rehearsal and uploaded-file backup — separate disposable database and authorized storage access needed; SQL dumps do not include file bytes.
- [ ] One unlinked YouTube chat — original account reconnect/authorization needed.
- [ ] Meta/Google reviews and changing passwords previously shared in chat — account-owner actions needed.
- [ ] Google Drive automatic backup — deferred by owner, not configured or claimed operational.

## Team merged into Team Desk — Nov 8
- [x] Member/invite controls moved into Team Desk's Team members tab; duplicate sidebar/search entry removed and /team redirects to members. Basic team access remains available when advanced tools are off or Desk reads fail; server role checks unchanged.
- [x] 425 tests across 70 files pass, including merged-tab availability/reviewer tests. Preview build OK; old Team path correctly reaches sign-in on desktop/phone without page errors.
- [ ] Invitations, workspace-switch and mobile acceptance need an authorized session; merged members and invoice persistence are confirmed by owner screenshots. No live writes, messages or charges performed by the agent; Google Drive remains deferred.

## Team Desk complete schema follow-up — Nov 8
- [x] Prepared combined repair for five screenshot-confirmed missing tables as a single transactional DO statement, compatible with Super Admin Run SQL. Invoice table is already installed per owner's result; no live repair was applied here.
- [x] Reproduced explicit BEGIN/COMMIT failure (0A000) inside admin_exec_sql; replacement runs twice through the same EXECUTE mechanism and preserves settings. Verified cross-workspace assignment denial and server-only integration tables. Team Desk missing-source reads and integration write failures now reject instead of reporting empty/off/success.
- [x] Full suite: 421 tests across 69 files pass; latest preview build OK. Actual Team Desk handler tests reject each missing assignments/settings/approvals source and accept confirmed empty reads.
- [ ] Verify Shared inbox, Approvals and API/webhooks against the live database; independent reports now load and invoice persistence is screenshot-confirmed, but other schema installation is unconfirmed. Live target remains separate from connected Cloud.

## Team Desk invoice repair — Nov 8
- [x] Prepared docs/sql/railway-client-invoices-repair.sql: repeatable, transaction-wrapped table/grants/reviewer RLS/client-membership checks/index and optional audit trigger. Add invoice disabled until invoice/client reads succeed. Connected Cloud has all six Team Desk tables; it is not the affected live database and was left unchanged.
- [x] Isolated PostgreSQL test reproduced missing relation, ran repair twice preserving a ₹500 unpaid invoice, and verified manager read, unrelated-client write denial, agent/other-workspace isolation and anonymous denial. Eight focused tests pass; preview build OK.
- [x] Owner's SQL-editor result confirms client_invoices installed on the live database. Earlier explicit-transaction script failed in the in-app runner; the new Team Desk repair avoids that incompatibility.
- [x] Latest owner screenshots confirm invoice creation/readback and manual paid status, including ₹200 unpaid/₹500 marked-paid totals. No automatic migration or history reset performed.

## Current dashboard request — Nov 8
- [x] Move Automation templates above Workspace performance; remove standalone attention/banner from dashboard and show account, unread-message and failed-post items in the shared notification bell with scoped read controls. Delivery/security logic unchanged.
- [x] Regression suite: 415 tests across 66 files pass; latest preview build OK. New tests verify 12 unread messages route to Inbox, confirmed-empty versus unavailable sources, publishing visibility and affected-record read identities.
- [ ] Signed-in dashboard order, notification clicks and phone layout verification: preview session mint failed because no account matches the requesting user; browser reached /auth without page errors. Requires preview sign-in or deployed-release verification. Other live actions still need test targets, payment approval and hosting access listed below.

## Remix setup (Nov 5)
- [x] Add independent Super Admin Enabled / Hidden / Coming soon controls for Create Post and Calendar, including direct page visits (4 availability tests and 26 checkout/form tests passed).
- [ ] Verify Super Admin publishing selectors and customer Coming soon views signed in (blocked: no preview auth account matches the requesting user; sign-in required).
- [x] Automatic Razorpay checkout: separate product deliverables from manual payments, enable paid pages without manual links, enforce paid access and test checkout selection (26 focused tests passed).
- [ ] Verify signed-in product save and actual Razorpay payment → return → access/email (blocked: requesting user has no matching preview auth account; requires sign-in and a test payment).
- [ ] Replace CRON_SECRET, DATABASE_URL, Google OAuth credentials, Meta credentials/verify token, and Razorpay credentials (blocked: renewed secure form declined; values unchanged).
- [x] Refresh remixed backend connection (managed connection refreshed successfully).
- [ ] Clear copied Drizzle migrations and scaffold an empty migration set (blocked: no supported remix-reset tool is available; direct journal/snapshot deletion is prohibited).

## Nov 5
- [x] Agency: only the main Agency owner owns client workspaces; others join as members, can't pay or remove the owner.
- [x] Delivery page: after a successful Razorpay payment, return buyer to the page signed in with purchases open, and email a receipt/access link.

## Agency client entitlements (Nov 4)
- [x] Resolve active parent Agency benefits for existing/new client workspaces, including connections, branding, labels and quotas.
- [x] Add deployment repair and regression tests without changing workspace data isolation.
- [ ] Verify signed-in client workspace and real Meta connection after Railway deployment (blocked: no preview account matches the requesting user; requires preview sign-in and Meta authorization).

## Oct 15 filter repairs
- [x] Repair Calendar, Inbox and Contacts filtering; tests and signed-in controlled-data browser checks pass for switching between two accounts.
- [x] Make dashboard template replies grey by default and blue on card hover; browser verified.
- [x] Re-link chats whose account link was lost (cause of "All shows many, one account shows 1-2"); runs on deploy + after account connect.
- [ ] Verify these three filters against the owner's Railway account data (preview session has no connected accounts or messages).

Source of truth: `DM_FB_IG_YT_Techaasvik_Master_PRD_Phasewise.md` (uploaded PRD).
Decisions: build on Lovable, keep code portable for a later Railway export.
Real Meta + YouTube credentials are available when we reach OAuth phases.

- [x] Phase 0 — Product foundation (PRD supplied by user, tokens + IA derived)
- [x] Phase 1 — Design system + app shell (sidebar, topbar, switchers, primitives, dashboard shell)
- [x] Phase 2 — Multi-tenant core + auth + security (orgs, roles, RLS, login/signup, protected routes)
- [x] Phase 3 — Social OAuth & Account Center (Meta credentials live; YouTube pending Google credentials)
- [x] Phase 4 — Webhook / event gateway (Meta callback, signature check, event feed)
- [x] Phase 5 — Instagram messaging foundation
- [x] Phase 6 — Facebook messaging & comment automation (public reply, private DM from comment, hide comment)
- [x] Phase 7 — Unified inbox + comments (search, platform/type/status filters, unread-only, status controls)
- [x] Phase 8 — Automation engine V1 (keyword rules, auto-reply, cooldown + daily cap, run log)
- [x] Phase 9 — Response variations + safety engine (rotating replies, kill switch, blocked + opt-out words, quiet hours, per-contact cap)
- [x] Phase 10 — Rate limit / quota / viral protection (org hourly+daily caps, spike auto-pause, usage panel)
- [x] Phase 11 — Publishing & content calendar (composer, scheduling, month calendar, publish queue + cron endpoint)
- [x] Team management (invites, roles, remove) — Phase 2 leftover
- [x] Publishing upgrade — multi-account publish in one go, media upload (image/video/carousel), reel + story formats
- [x] Phase 12 — YouTube publishing, professional comment automation, inbox sync and manual public replies
- [x] Phase 13 — AI layer (caption writer, reply drafts, automation rule suggestions)
- [x] Phase 14 — Analytics & ROI (engagement, reply speed, automation share, publishing results)
- [x] Phase 15 — Super admin / operations console (own shell: overview, organizations + tenant detail, users, accounts, automations, messages, jobs/queue, webhooks, API health, plans, security & audit, system settings with global pause + incident banner + feature flags)
- [x] Phase 16 — Agency / white label (workspace branding, logo, brand colour, support email, client workspaces)
- [x] Phase 17 — Export pack for Railway (Dockerfile, .dockerignore, railway.json, .env.example, scripts/migrate.mjs, DEPLOY-RAILWAY.md)
- [x] Fix follow-confirmation delivery after “I followed” and test follower transitions.
- [x] Deliver directly to existing followers on “Send me the link” while retaining the non-follower confirmation path.
- [ ] Confirm delivery with a fresh Instagram comment after Railway deploy; tap payload parsing and quick-reply delivery are fixed (requires a real account follow/tap).
- [ ] Verify both existing-follower and non-follower button flows on Railway after deployment (requires real Instagram taps).
- [x] Bind Meta button taps to the original Instagram follow gate when Facebook and Instagram share a Page.
- [x] Parse staged follow-gate payloads with the canonical UUID parser and expire superseded waiting gates.
- [x] Add real Meta webhook tracing, provider error visibility, and super-admin-controlled simulator access.
- [ ] Verify fresh follower and non-follower taps after Railway deploy using correlation IDs (external deploy required).
- [ ] Verify the repaired comment rule receives a fresh Instagram comment after Railway deploy (external deploy required).

- [x] Plan limits done
- [ ] User: set INSTAGRAM_APP_SECRET in Railway (app ID 1497788405165320)
- [x] Super-admin user profile editing (name, email, password) with audit logging
- [x] Public contact, disclaimer, and refund pages with professional shared footer
- [x] Support inquiry inbox for super admins with optional configured email alerts
- [x] Contextual YouTube comment replies (Hindi/Hinglish/English intent, DM wording stripped)
- [x] Multi-provider AI with automatic failover (multiple OpenRouter keys → NVIDIA → OpenAI → built-in)
- [x] Secure super-admin AI provider panel (write-only keys, masked display, hourly spend cap, prompt-injection sanitising)
- [x] Google Cloud / YouTube API verification guide (`docs/GOOGLE-YOUTUBE-VERIFICATION.md`)

## Current: AI assistant + SEO/Blog plan
- [x] Dashboard AI assistant uses Super admin AI keys (OpenRouter → NVIDIA → OpenAI → Lovable AI)
- [x] SEO Phase 1 (part): robots.txt, sitemap.xml, llms.txt
- [x] SEO public content coverage: canonical links plus appropriate JSON-LD on informational pages/blog/converter; personal transactional pages stay noindex, missing articles noindex.
- [x] Phase 2–3: public blog + super-admin blog editor with Rank Math-style score
- [x] Phase 4: AI blog assistant
- [x] Phase 5: starter draft articles
- [x] Phase 6: GA4/GTM/AdSense/Pixel/GSC/Bing settings + cookie banner
- [x] AI assistant daily limit per user (default 5, super-admin setting)
- [x] Roadmap Phase A: story reply/mention triggers, ice breakers, Messenger menu (flag off by default, not pushed)
- [x] Roadmap Phase B: visual flow builder (design + test only, flag off by default, not pushed)
- [x] Phase B live sending (own Super Admin switch, off by default) + drag-and-drop steps
- [x] Roadmap Phase C: AI agent (knowledge base, handoff, intent/sentiment/lead score; flag off, not pushed)
- [x] Contacts link in left menu + Contacts guide (in-app and USER-GUIDE)
- [ ] Railway DB: apply new tables flow_runs, contact_tags, conversation_insights (needs Railway deploy)
- [x] Phase D CRM (part): tags, email/phone, custom fields, saved segments, CSV export, contact detail
- [x] Phase D rest: capture email/phone inside flows, broadcasts, Sheets/webhook sync, abandoned-conversation nudges (24h window, once per conversation)
- [x] Flow templates, ice breaker presets, in-app guides
- [x] Phase E: Razorpay payment links (per workspace keys), coupons, delivery pages, 24h payment reminder, sales report
- [ ] Phase E live test: needs a real Razorpay account + Instagram DM on Railway
- [x] Phase G: Team desk (shared inbox assignment, approval queue, client reports + CSV, per-client billing invoices, API keys, signed outgoing webhooks); Phase F skipped by user
- [x] Phase H: Trust & safety (health score, predictive guard, policy checker + compliance centre, audit trail)
- [x] Next: Phase I
- [x] Update user guide for current navigation, account selection, sample/usage distinctions, buyer access, publishing controls, discoverability and live acceptance checklist; live guide walkthrough still requires an account.

- [x] P2: human takeover, YouTube quota backoff, scheduler heartbeat, P2 reports
- [ ] Owner: TOKEN_ENCRYPTION_KEY, live IG/FB checklist, App Review, async webhook

- [x] Delivery page landing templates + formatted rendering + live preview
- [x] Flow builder: create product / coupon in place
- [x] Flow builder: lead form step (custom + multiple-choice fields)
- [x] Flow builder: free-placement node canvas with connectors
- [x] Flow builder follow gate: "I followed" tap (live tap check needs a real Instagram account after deploy)

## Current: Flow Builder parity and scrolling
- [x] Flow-owned Opening DM and run-bound follow confirmation callbacks
- [x] Separate FLOW / Rule / System activity with source-filtered reads
- [x] Bounded template and Try it result scrolling
- [x] Canvas-local anchored wheel and keyboard zoom
- [x] Regression tests (179 passing), signed-in browser scrolling/zoom checks and guide updates
- [ ] Owner: deployed Instagram/Facebook opener → follow tap delivery verification
- [x] Flow Builder: visible automatic “I followed” preview and advanced All-in-one qualification-to-sale template
- [x] Buyer-bound offer page step with in-place product/page setup and personal payment CTA
- [x] Delivery pages: optional private product image, fixed countdown/expiry state, professional format and hybrid form configuration

## Sales & flows upgrade (Oct 9)
- [x] Rename Revenue → Sales & Revenue
- [x] Delivery page leads in Contacts + CSV export
- [x] 1 run = 1 usage count; Activity grouped per run
- [x] Flow Builder: choose specific posts/reels
- [x] Expert-level templates (all categories + All-in-one)
- [ ] Owner: redeploy Railway and test a real comment on a selected post

## Comment review and mobile (Oct 10)
- [x] Add shared bell notifications and dashboard alerts for skipped/failed automations, with read controls.
- [x] Prefer reel thumbnails and replace unavailable PostPicker images with clean icons.
- [ ] Verify notifications with a real signed-in workspace and fresh skipped rule (preview has no auth users; sign-in required).
- [x] Supported comment edit/delete controls and eight moderation regression tests verified; live Meta action verification remains separate.
- [x] Customer/admin phone layout improvements implemented; subsequent loaded-page checks verified Contacts/Automations overflow fixes and sampled Team Desk/Trust & Safety layouts. Remaining current-release representative workflow acceptance is tracked in the consolidated checklist.
- [x] Verified comment re-submission/screencast guide covers platform-specific reply/edit/delete, native confirmation, permissions and reviewer checklist.
- [ ] Owner: verify actual Meta comment changes on the connected test Page/account after deployment.
- [x] Posts list: Feed/Reel/Story/Carousel tabs + badges, thumbnails, likes/comments/shares/views
- [x] Posts: Edit button (drafts full edit, live Facebook caption edit) and real delete on Facebook/YouTube (Instagram has no delete API)
- [ ] Verify live delete/edit/stats on a real connected account (needs signed-in workspace)

## Oct 13 batch
- [x] Reel thumbnails show first video frame
- [x] YouTube edit shows its own message (not Instagram's)
- [x] Composer: title for IG/FB, YouTube title/description/tags, Instagram trial reel copy
- [x] Calendar shows platform + post type instead of caption
- [x] Inbox fits the screen on desktop
- [x] Contacts 8 per page, Comments 10 per page
- [x] Flow post list scrolls under the cursor; mobile notice on Flow Builder
- [x] Rule editor opens as a full page view
- [ ] Verify on live account after deploy (needs signed-in workspace)

## Activity journey borders (Oct 14)
- [x] Trace rule callbacks and group outer activity borders across one contact's multi-event journey, with regression tests.
- [ ] Verify activity borders in the signed-in preview without sending messages (blocked: requesting user has no matching preview account; sign-in required).

## Multi-account selector (planned, awaiting go-ahead)
- [x] Shared session-scoped workspace account/platform selection across Inbox, Comments/Workflows post picker, Calendar, Publishing, Contacts, Sales, Team Desk, Analytics, Account Health and Growth; AI Assistant remains non-account-based.
- [x] Connected-account labels on Inbox rows/thread and Publishing rows; Comments/post picker show account names and Comments reply panel identifies its account. Signed-in label verification remains blocked.
- [x] Account picker: Inbox, Comments, Workflows, Calendar, Contacts, Analytics
- [x] Account picker: Sales & Revenue, Team Desk, Growth (AI Assistant not account-based)
- [x] Trial Reel option removed from Create Post

- [x] Platform + account filters across pages, dashboard templates/new automation, guide cleanup
- [x] Per-account safety limits with Super Admin max values; per-account usage table
- [ ] Verify per-account limits and filters with real connected accounts (needs live data)
- [x] Lock Agency-only branding fields in Settings
- [x] Add instagram_business_manage_comments scope + test comments button

## Master plan (Nov 2026) status
- [x] Sidebar expansion persists through navigation/drawer remounts via user-keyed layout state; user/admin scopes remain separate. Both sidebars gain group icons, readable spacing, nested rails and selected-page accents; navigation regression reproduced then confirmed passing.
- [ ] Verify polished sidebar appearance signed in on desktop/mobile (blocked: requesting user has no matching preview auth account).
- [x] Increase sidebar group headings to readable 14px semibold text with stronger contrast and larger click targets in both dashboards; queue list explicitly labels its 100-job cap with refresh/unavailable handling.
- [x] User and Super Admin sidebar groups default closed; opening one closes the other, using shared tested state transitions.
- [x] V6 dashboard overview: performance-first layout, 7/30-day selector, refresh/retry, quick actions and attention items; feature controls preserved (300 regression tests passed).
- [ ] Verify dashboard overview signed in on desktop/mobile (blocked: preview backend has no auth users; sign-in required).
- [x] V6 dashboard increment: source-derived setup milestones and lead/revenue summary using existing workspace reads (302 tests passed; authenticated visual check blocked by no preview auth users).
- [x] Item-level conversation/post navigation from dashboard and search; validated workspace-scoped URL selection (306 tests passed).
- [ ] Verify exact chat/post opening and browser Back signed in on desktop/mobile (blocked: preview backend has no auth users).
- [x] Super Admin Command Centre overview: priority actions, refresh/retry, operations shortcuts, explicit event sample and unavailable states; existing permissions unchanged.
- [ ] Verify Command Centre signed in as Super Admin on desktop/mobile (blocked: preview backend has no auth users).
- [x] Super Admin menu grouped into six domains; workspace details organized into nine tabs with existing controls preserved.
- [ ] Verify admin groups, tab switching and unsaved drafts signed in (blocked: preview backend has no auth users).
- [x] Workspace directory: name/slug search, plan/status filters, sorting and retry; System Settings: retained grouped tabs and guarded loading controls.
- [ ] Verify directory filters and Settings draft retention signed in (blocked: preview backend has no auth users).
- [x] Owner/name/email search and effective Agency plan/expiry directory fields; billing separates sampled paid orders from grants and removes fabricated MRR and hardcoded catalogue.
- [x] Directory CSV export matches filtered/sorted authorized rows, escapes spreadsheet formulas and separates assigned/effective access; billing labels catalogue prices and assigned plans explicitly with refresh/unavailable handling.
- [x] Operational presentation audit: verified finalized processing rate, probe-separated webhook filters, sampled/mixed alert labels and explicit unavailable states instead of false healthy zeros.
- [x] Remaining admin lists: users/accounts/rules/messages have manual refresh, stale/unavailable states and loaded-count labels; automation event counts are explicitly separate from billable journeys.
- [x] Shared AdminTable stacks labelled cells on phones while retaining desktop tables and rendering each action once; wide controls scroll locally without widening the page.
- [x] Customer dashboard review: absent metrics/usage show unavailable rather than fabricated zeros; accounts/conversations/posts/activity distinguish missing reads from empty lists; period labels and long text wrapping improved.
- [x] Inbox/Contacts acceptance review: refresh controls and separate loading/unavailable/stale states for chats, messages and delivery leads; outreach controls wait for confirmed settings and reset between workspaces.
- [x] Inbox/Contacts count audit: label 100-conversation and 2,000-lead samples; explain filtered/exported sets, await CRM details before contact counts/export, and constrain contact fields on phones.
- [x] Analytics/Growth presentation audit: unavailable metrics instead of fabricated zeros, refresh/stale states, current-record versus date-range labels, sampled funnel scope and honest competitor/anomaly labels.
- [x] Growth source-read integrity: seven failed-read paths reject instead of returning zero/normal insights; confirmed empty reads and workspace scoping preserved in regression tests.
- [x] Team Desk/Team presentation: refresh and unavailable/stale states for members, reports, invoices and integrations; drafts reset by workspace/account; manual invoice status labels and wrapping tabs.
- [x] Team Desk integration controls stack on phones; long webhook URLs/credentials wrap, controls have accessible labels, and confirmed empty key/webhook lists are explicit (signed-in visual verification still blocked).
- [x] Account Health/Trust & Safety presentation: refresh, unavailable/stale states, sampled audit/policy labels, and unsigned requests separated from verified delivery failures; safety controls unchanged.
- [x] Delivery Health presentation: retry/stale states, event/step/sample labels instead of verified-success claims, cautious missing-tap diagnosis, and long trace wrapping; sending unchanged.
- [x] Automation report presentation: refresh/stale states, 20,000-event sample and billing distinction, filtered versus summary counts, explicit empty selections, and accurate 500-row/CSV labels.
- [x] Revenue presentation: refresh/stale states, workspace-keyed retained tabs, wrapped phone navigation, 30-day sample/account-scope labels and product names/paid time beside payment amounts.
- [x] Revenue source-read integrity: all eleven source failures reject with a safe unavailable error instead of false zeros/empty/settings-off results; confirmed empty reads and workspace/account scope retained, membership verified before reads.
- [x] Usage presentation: unavailable/loading/stale states, rolling activity versus billable monthly runs, workspace defaults separated from effective account caps; refresh controls and local per-account scrolling.
- [x] Workspace/per-account usage source-read integrity: eleven failed reads now reject safely; confirmed empty reads remain valid and account membership gating unchanged.
- [x] Monthly grouped-run display rejects failed/invalid RPC counts without a sent-step fallback; shared sending-quota enforcement unchanged (focused regression tests added).
- [x] Monthly usage display rejects failed workspace/settings/Agency-parent/active-rule reads and missing workspaces; catalogue and overrides share one confirmed settings snapshot, shared enforcement defaults unchanged.
- [x] Customer Billing presentation: refresh/unavailable states, no unconfirmed Starter/zero/default catalogue display, rolling activity labels, latest-10 order scope/dates and mobile wrapping; payment implementation unchanged.
- [x] Billing source-read integrity (workspace/orders/membership/catalogue), with failed-read tests and membership-before-history checks; payment mutation/delivery unchanged.
- [x] Remaining-page presentation audit: Connected Accounts, Publishing, Calendar, Comments, Automations, Workflows, Settings and AI have targeted unavailable/retry/draft-reset/mobile fixes. Full suite: 390 tests pass.
- [x] Reproduced Growth failure on the affected live account: exact RLS reads identify missing public.growth_competitors (PGRST205); all six other Growth sources succeed. Prepared a proposed additive repair in docs/sql/railway-growth-repair.sql; not applied to either backend.
- [x] Growth repair was applied by the owner and the live Growth page was confirmed loading in the subsequent session.
- [ ] Signed-in desktop/mobile acceptance, export/billing/health checks (blocked: requesting user's preview account/session unavailable); local presentation audit completed.
- [x] Converter 800MB + clear after download; Super Admin temp cleanup button
- [x] Coupons: manual Apply + auto-apply (?coupon=), discount from MRP, server re-check
- [x] Per-workspace Super Admin feature switches + health; enforced on server for revenue writes, public pages, checkout, emails
- [x] Emails: branded receipt, creator sale/lead alerts, lead confirmation, one-by-one follow-up send from Contacts
- [x] Heading hierarchy (shared panels, page titles, delivery editor); homepage product visuals
- [x] Public browser checks: seven informational/converter pages have canonical/JSON-LD; Contact renders desktop/mobile without horizontal overflow or page errors.
- [ ] Real payment, email delivery and signed-in Super Admin checks — need live test by owner

## Remaining-work acceptance — Nov 7
- [x] Finished currently accessible read-only acceptance in one batch; externally blocked work skipped as requested (live deployment, provider actions, payment and admin-only changes remain pending, not completed).
- [x] Dependency-security follow-up: patched undici/js-yaml/seroval/source-map-js; migrated app validation to Zod 4.6.6 after API review and passing regressions, aligned framework copies. Final scan: no known vulnerabilities in 57 production dependencies; 397 tests pass, preview build OK, four public pages HTTP 200 with no runtime errors. Signed-in compatibility remains blocked by account access.
- [x] Final regression suite: 397 tests passed; preview build OK. Ten public pages checked on desktop/phone: HTTP 200, required metadata, no horizontal overflow or page errors; signed-out Growth redirects to sign-in. These checks do not verify authenticated workflows.
- [x] Added Growth source-specific, code-only server diagnostics; preserves generic browser errors and all RLS/workspace reads. Actual affected-account failure remains unverified, not fixed by this diagnostic change.
- [x] Reconciled Railway setup with current scheduler/migration inventory; documented encryption, Instagram secret, sender configuration and managed-Cloud credential limitations.
- [x] Affected live account signed in successfully; Analytics, Revenue, Usage, Billing, Calendar and Settings load on desktop without horizontal overflow. /admin correctly redirects this non-Super-Admin account to /dashboard. Growth missing-table error reproduced; Inbox unavailable states need diagnosis.
- [x] Live Growth repair applied by the owner and later live Growth reads confirmed working. GitHub-to-Railway code deployment verified; remaining Super Admin acceptance stays separately open.
- [x] Live user sidebar stays open after navigation and closes manually; 11 of 12 sampled mobile pages fit without horizontal overflow. Reproduced Automations header overflow at 390px and fixed its local action wrapping; live confirmation needs deployment.
- [x] Inbox itself loads correctly; two historical conversations show missing connected-account labels, not failed conversation reads. Repair verification needs live database deployment/relink access; no live messages or workspace data changed.
- [ ] Live integrations: fresh IG comment/follower taps, moderation/publishing, Agency connections and real-account filters. Blocker: connected provider accounts and Railway deployment access.
- [ ] Buyer acceptance: authorized test payment → return → receipt/access email → private download, including unpaid denial. Blocker: creator/buyer accounts, payment authorization and verified email sender.
- [ ] Deployment: configure/rotate secrets, verify encryption backfill and scheduler, apply missing schema through an approved migration, complete Meta/Google reviews. Blocker: external service access and credentials.
- [ ] Copied migration reset remains blocked: supported reset mechanism unavailable; no journal or snapshot deletion performed.
- [x] Expanded live read-only acceptance: 20 real customer routes checked after loading on desktop and phone; /delivery-health is not a route (health is under Account Health), not counted as a passing page. Growth remains unavailable. Contacts mobile overflow reproduced with loaded leads; local min-width wrapper/select fix passes live-DOM simulation, but updated-release verification still needs Railway deployment. Contacts CSV download and nonmatching search confirmed; 8 related tests pass and preview build OK.
- [x] Live interactive acceptance on desktop and phone: global search found a real contact and opened its selected Inbox thread, browser Back returned to Dashboard, unsaved product name survived Products → Coupons → Products, and 90-day automation report CSV downloaded successfully. Contacts Instagram filter showed 7 matching loaded contacts and persisted through sidebar navigation to Analytics. No saves, messages, posts or payments performed; unsaved test text cleared.
- [x] Final accessible batch: delivery-lead CSV downloads on desktop/phone; all four Team Desk and four Trust & Safety tabs open without page overflow or alerts; activity loads 40 automation journeys / 97 entries / 155 steps with visible journey border; Usage/Account Health refresh succeeds and per-account table stays locally scrollable. All 397 tests across 60 files pass. No live saves, provider actions, messages or payments performed. Client report/admin exports lack a usable authorized report/admin account and were skipped, not counted as passing downloads.
- [x] Connected GitHub alternate verified: Smbj's GitHub API reports dm-automation-v6 → Techaasvik / production Railway deployment successful at 14:38 UTC. Live Contacts and Automations phone checks now confirm no horizontal page overflow without DOM simulation. Growth remains unavailable; code deployment success does not prove live database repair.
- [x] Backend mismatch freshly confirmed: connected managed database contains growth_competitors but not the affected live auth account; live browser backend requests do not target the connected managed backend. Railway hosts the app, while its independently hosted database is a different backend. No schema change applied to the wrong database.
- [ ] Skipped: client/admin exports, remaining admin drafts, active safety enforcement and fresh activity/notification delivery. Blocker: current live account is not Super Admin, usable authorized reports are unavailable, and real delivery actions require provider authorization. Hosting secrets/database administration remain inaccessible via GitHub deployment status.
- [x] Checked the remaining GitHub administration alternative: the repository has one Build workflow (source analysis only), no migration step, and zero repository Actions secrets. No existing authorized live-database repair path was found through this connection; no workflow, secrets, database, provider actions or production data changed. All remaining items above stay explicitly blocked/skipped.

## Database recovery follow-up — Nov 7
- [x] Nov 8 acceptance: supplied live account signed in. Inbox, Comments, Calendar, Account Health, Trust & Safety, Revenue, Usage, Analytics, Growth and Settings load without alerts/desktop overflow; two connected Meta accounts and Agency client list visible. /accounts, /publishing and /agency are not actual routes, so their 404 responses are excluded. No sends, deletes, saves or charges performed. No disposable targets or payment amount/recipient supplied.
- [x] Fixed reproduced encryption verification defects: failed reads reject, secondary plaintext refresh/webhook secrets are included, compare-and-set protects both originals, counts only updated rows. Cron errors return 503. Scheduler requests time out and rejected heartbeat writes/reads cannot report success; retired backup job absent from built-in scheduler. Added buyer paid/unpaid/expired/workspace authorization and private-file URL tests. 411 tests pass across 66 files; preview build OK.
- [ ] Requested live delivery/moderation/publishing and fresh notification/safety checks need identified disposable test targets; Agency account connections and cross-account filter acceptance need correct live pages/connected providers. Live checks above verify loaded views, not external actions.
- [ ] Requested payment→receipt→private download remains unverified: payment question unanswered, no authorized product/amount/recipient. Automated paid/unpaid denial checks pass but no real payment/email was attempted.
- [ ] Requested hosting secret rotation/encryption backfill execution/scheduler verification and external legacy-job removal remain blocked: available connection is GitHub only; do not change connected Cloud secrets and claim Railway was rotated. No safe copied-migration reset tool/workflow available; no live reset or history deletion performed.
- [x] Final continuation: strict three-mode dump validation, confirmed actor and mandatory pre-download audit, no-store headers, failed-stream errors and sanitized startup failures; hosting documentation aligned. 401 tests pass across 62 files; preview build OK; anonymous dump/cron requests return 401. Signed-in dump and restore remain unverified.
- [ ] Google Drive connection requested Nov 7 at 17:42 UTC and declined; automatic full backups remain blocked by Drive authorization plus Railway scheduler/runtime setup.
- [x] Current continuation: removed callable legacy partial-backup operations and retired their cron (authenticated requests return 410); SQL audit must save before execution and contains no query text. SQL always asks for confirmation, clears stale results and reports failures without asserting rollback.
- [x] Verification: 399 tests pass across 61 files; latest preview build OK. Anonymous dump and unsigned backup-cron requests return 401; both live and local admin pages redirect this fresh signed-out browser to /auth. These checks do not verify signed-in execution or restore.
- [ ] Verify cleaned Database Backups page and SQL audit on deployed Railway release (requires current authorized live session; no destructive SQL or full restore performed).
- [x] Screenshot reviewed: relink SQL completed and reports one remaining unlinked chat; it does not prove a full database restore or an SQL failure.
- [x] Legacy partial export/import UI and operations retired; full Railway dump and authorized SQL editor remain. Existing backup rows are preserved; no database changes made in this continuation.
- [x] Regression verification: 398 tests pass across 61 files; latest preview build OK. Live session has expired and redirects to /auth, so Growth and Super Admin recovery UI were not reverified signed in.
- [ ] One unlinked YouTube conversation remains after the owner's diagnostic; confirm/reconnect its original account before any scoped repair (blocked: original-account authorization).
- [ ] Confirm updated recovery page as authorized Super Admin on the deployed release; remove legacy external backup schedule if configured (blocked: admin/hosting access).
- [ ] Google Drive scheduling remains unconfigured; do not describe saved settings as an operating backup.
- [ ] Live Meta/YouTube/Agency actions, notifications/safety, payment→email→private download/unpaid denial, credentials/encryption/scheduler/provider reviews and migration reset remain blocked as listed above.
