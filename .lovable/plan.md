# Future Roadmap — making the tool advanced and unique

Research-based plan (Meta's current Instagram/Messenger capabilities + what competing tools like ManyChat, Chatfuel, Inro, DMdaddy ship in 2026). Nothing here is built yet — this is the build order for later phases.

## Where we stand today

Already live: comment → public reply → DM with link, follow-gate with buttons, keyword rules, safety limits, unified inbox, publishing + calendar, AI drafts, analytics + automation report with CSV, super admin console, white label.

What competitors have that we don't yet: story-reply triggers, visual flow builder, AI agent that actually converses, lead capture into a CRM, WhatsApp channel, e-commerce checkout in chat.

## Phase A — Entry points we are missing (biggest quick win)

Right now a conversation can only start from a comment. Meta supports several more starting points:

1. **Story reply & story mention triggers** — someone replies to your story or mentions you; auto-DM them. This is one of ManyChat's top selling points.
2. **Keyword-in-DM trigger** — someone DMs "PRICE"; the rule answers directly.
3. **Ice breakers** — up to 4 tappable FAQ questions shown before anyone types, set per account ([1](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/ice-breakers)).
4. **Persistent menu** — an always-visible menu in the chat (pricing, catalogue, talk to a human) ([2](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/persistent-menu)).
5. **Live-reel / live comment and ads-click (CTX) entry** where the account qualifies.

## Phase B — Visual flow builder

Replace "one rule = one reply" with a drag-and-drop canvas: message → wait → question → condition → tag → action. Keeps existing keyword rules working as a simple mode; the flow engine runs on top of the same safe sending layer so current automation is untouched.

Includes: delays, branching on user answer, buttons/quick replies per step, A/B split, goal tracking per step.

## Phase C — AI agent (not just AI drafts)

- Train on the user's own content: upload PDF, paste website URL, pull recent captions → knowledge base.
- AI answers freeform questions inside the 24-hour window, using that knowledge base.
- Confidence threshold: low confidence → hand over to a human, mark the conversation "needs reply".
- AI intent tagging (buying, support, spam, collab) and auto-routing.
- AI sentiment + lead scoring on every contact.

## Phase D — Contacts as a real CRM

- Custom fields, tags, segments, notes, lifecycle stage.
- Capture email/phone inside the chat and validate it.
- Contact timeline: every comment, DM, tap, link open in one view.
- Broadcast / re-engagement to tagged segments inside Meta's messaging rules (24-hour window, human-agent tag only where allowed).
- Export/sync: CSV, Google Sheets, webhook out, Zapier/Make.

## Phase E — Revenue features

- Link-in-bio style delivery page per rule, with click and conversion stats.
- Payment link in DM (Razorpay already integrated) — sell a product or booking straight from the chat.
- Coupon code generator, one code per contact, expiry.
- Abandoned-conversation follow-up (auto nudge after 1h/24h if no tap).
- Attribution report: comment → DM → link open → payment.

## Phase F — More channels

- **WhatsApp via your own in-house platform** (bulkmarketing.techaasvik.in, official Cloud API, you are a registered Tech Provider). We do not rebuild WhatsApp — we call your existing backend with its API key: pull contacts, push contacts captured from Instagram/Facebook, trigger campaigns, and send a WhatsApp follow-up when a DM link is not opened. One "WhatsApp handoff" step inside automation rules.
- Threads and Telegram where APIs allow.
- TikTok DM automation (officially opened to partners).
- Email/SMS fallback when a DM window closes.

## Phase G — Team, agency and scale

- Shared inbox with assignment, internal notes, canned replies, SLA timers.
- Approval queue: AI drafts a reply, a human approves before send.
- Client reporting: branded PDF/scheduled email report per workspace.
- Per-client billing and usage limits for agencies.
- Public API + outgoing webhooks so customers can build on top.

## Phase H — Trust, safety and compliance edge

This is where we can genuinely beat the competition, because our safety engine is already strong.

- Account health score per connected account (send rate, block rate, failure rate, token expiry).
- Predictive rate-limit guard: slow down before Meta throttles instead of after.
- Compliance centre: consent log, STOP handling proof, data export/delete per contact (GDPR/DPDP).
- Automatic Meta policy checker on rule text before it goes live.
- Full audit trail already exists — surface it as a downloadable compliance report.

## Phase I — Growth and intelligence

- Best-time-to-post from real engagement data.
- Competitor benchmark using public insights.
- AI content ideas from top-performing comments/DMs.
- Funnel heatmap: where people drop off in each flow.
- Anomaly alerts ("this rule's DM delivery fell 60% today").

## Suggested build order

Highest value per effort first:

1. Phase A (story + DM keyword triggers, ice breakers, persistent menu)
2. Phase D (CRM fields, tags, capture)
3. Phase C (AI agent with knowledge base + human handoff)
4. Phase B (visual flow builder)
5. Phase E (payments and attribution)
6. Phase H (health + compliance edge)
7. Phase F (WhatsApp and other channels)
8. Phase G (team/agency)
9. Phase I (growth intelligence)

## Technical notes

- New triggers need extra webhook subscriptions (`message_reactions`, story `messages` payload shape, `messaging_postbacks` already handled) plus extra permissions at app review. Existing signature verification and dual-secret handling stay as is.
- Ice breakers and persistent menu are `messenger_profile` writes per connected account — new server functions plus a per-account settings screen; no change to the send path.
- The flow engine must reuse the current safe-send layer (cooldown, per-post rule, caps, kill switch) rather than call the Meta API directly, so the locked DM automation stays intact.
- WhatsApp is served by the existing Techaasvik backend, not a new Cloud API build. Integration is a server-side client calling that API with an `X-API-Key` stored as a secret (never in the browser, never in the repo), one key per workspace where possible, with retries and failure logging into the same activity feed. WhatsApp's own 24-hour window and template approval rules still apply on that side.
- Every phase ships behind a feature flag in platform settings so super admin can roll out per workspace.
