# DM FB-IG-YT by Techaasvik — Build Roadmap

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
- [ ] SEO Phase 1 rest: JSON-LD on all public pages, canonical tags
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
- [ ] Final user guide covering all features (docs/USER-GUIDE.md, updated after each phase)

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
- [ ] Add supported comment edit/delete controls with authorization and regression tests.
- [ ] Improve phone layouts across customer/admin pages and verify representative workflows.
- [ ] Add accurate comment re-submission and screencast instructions to Meta App Review guides.
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
- [ ] Shared "Account" selector (All / one connected account) persisted per workspace, reused by Inbox, Comments, Calendar, Contacts, Sales & Revenue, Team desk, Analytics, AI Assistant, Account Health, Growth insights.
- [ ] Account badge on every inbox row/comment/post + "Replying as @handle" on reply boxes.
- [x] Account picker: Inbox, Comments, Workflows, Calendar, Contacts, Analytics
- [x] Account picker: Sales & Revenue, Team Desk, Growth (AI Assistant not account-based)
- [x] Trial Reel option removed from Create Post

- [x] Platform + account filters across pages, dashboard templates/new automation, guide cleanup
- [x] Per-account safety limits with Super Admin max values; per-account usage table
- [ ] Verify per-account limits and filters with real connected accounts (needs live data)
- [x] Lock Agency-only branding fields in Settings
- [x] Add instagram_business_manage_comments scope + test comments button

## Master plan (Nov 2026) status
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
- [ ] Next: V6 acceptance audit and signed-in desktop/mobile verification; authenticated export/billing/health checks blocked by no preview auth users.
- [x] Converter 800MB + clear after download; Super Admin temp cleanup button
- [x] Coupons: manual Apply + auto-apply (?coupon=), discount from MRP, server re-check
- [x] Per-workspace Super Admin feature switches + health; enforced on server for revenue writes, public pages, checkout, emails
- [x] Emails: branded receipt, creator sale/lead alerts, lead confirmation, one-by-one follow-up send from Contacts
- [x] Heading hierarchy (shared panels, page titles, delivery editor); homepage product visuals
- [ ] Real payment, email delivery and signed-in Super Admin checks — need live test by owner
