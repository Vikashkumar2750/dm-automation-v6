# Future Roadmap — Advanced Automation Platform

Research-based plan (Meta API capabilities + competitor landscape: ManyChat, Chatfuel, etc.) to make this tool more advanced and unique. Built later, phase by phase. Every phase ships behind a feature flag so the locked DM automation never breaks.

## Phase A — More entry points (triggers)
- Story reply trigger, story mention trigger
- Keyword-in-DM trigger (not just comments)
- Ice breakers (FAQ buttons on first DM open) via `messenger_profile`
- Persistent menu (always-visible menu in the DM thread)
- Live-reel / ads-click comment-to-DM (CTX entry points)
- Technical: extra webhook subscriptions (`message_reactions`, story `messages` payloads); ice breakers and persistent menu are `messenger_profile` writes.

## Phase B — Visual flow builder
- Drag-and-drop canvas: trigger → condition → action nodes
- Existing keyword rules become "simple mode"; flows are "advanced mode"
- Flow engine reuses the same safe sending layer (rate limits, quiet hours, viral guard)

## Phase C — AI agent
- Knowledge base built from the user's own content (posts, FAQs, links)
- Freeform AI answers inside the 24-hour window
- Confidence threshold → human handoff when unsure
- Intent tagging, sentiment detection, lead scoring

## Phase D — CRM
- Custom fields, tags, segments on contacts
- Capture email/phone inside DM flows
- Contact timeline (every touch: comment, DM, link open, purchase)
- Broadcasts within Meta's messaging rules
- CSV / Google Sheets / webhook / Zapier sync

## Phase E — Revenue features
- Link-in-bio style delivery page for the final DM link
- Razorpay payment links inside DM
- Coupon codes
- Abandoned-conversation nudges
- Attribution report: comment → DM → click → sale

## Phase F — WhatsApp via the in-house platform
WhatsApp is NOT rebuilt here. The user's own multi-tenant WhatsApp platform (`bulkmarketing.techaasvik.in`, official Meta Cloud API, registered Tech Provider) is integrated by API key:
- Pull contacts from the WhatsApp tool
- Push contacts captured from Instagram/Facebook into it
- Trigger WhatsApp campaigns
- WhatsApp follow-up when a DM link is not opened
- One "WhatsApp handoff" step inside automation rules
- Technical: server-side client calling `techaasvik-backend.onrender.com/api` with `X-API-Key` (secret, never in browser/repo); per-workspace keys where possible; retries + failure logging in the same activity feed. WhatsApp's own 24-hour window and template approval still apply.

## Phase G — Team / agency
- Shared inbox with assignment
- Approval queue (junior drafts, senior approves)
- Client reporting, per-client billing
- Public API + outgoing webhooks

## Phase H — Trust & safety
- Account health score per connected account
- Predictive rate-limit guard (slow down before Meta blocks)
- Compliance centre, Meta policy checker on rule save
- Full audit trail

## Phase I — Growth intelligence
- Best-time-to-post suggestions
- Competitor benchmark
- AI content ideas
- Funnel heatmap (comment → DM → open → click)
- Anomaly alerts

## Build order
A → D → C → B → E → H → F → G → I

## Invariants
- Locked follower/non-follower DM automation is never modified by these phases.
- Every phase is behind a feature flag, off by default.
- Existing safety caps (60/hour, 500/day, per-contact limits, quiet hours) apply to all new sending paths.
