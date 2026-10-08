# DM FB-IG-YT by Techaasvik — Build Roadmap

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
- [ ] Flow-owned Opening DM and run-bound follow confirmation callbacks
- [ ] Separate FLOW / Rule / System activity with source-filtered reads
- [ ] Bounded template and Try it result scrolling
- [ ] Canvas-local anchored wheel and keyboard zoom
- [ ] Regression tests, browser checks and guide updates
