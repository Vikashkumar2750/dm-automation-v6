# DM FB-IG-YT by Techaasvik — Build Roadmap

## Oct 15 filter repairs
- [ ] Repair and verify Calendar, Inbox and Contacts platform/account filtering.
- [ ] Make dashboard template replies grey by default and blue on card hover.

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
