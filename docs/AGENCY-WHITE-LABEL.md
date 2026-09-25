# Agency (Custom Pricing) Plan — White-Label Guide

Last updated: 25 September 2026
Audience: internal (Techaasvik team). Not a contract — legal documents below must be drafted/reviewed by a lawyer before a client signs anything.

This document explains our Agency (custom pricing) plan: what white-label branding actually does in the app today, what we offer a client, how we hand a client their white-labelled workspace, what legal papers should be signed, what rights stay with us, and how reselling is handled and tracked.

---

## 1. What the Agency plan is

Agency is a **custom-priced plan** (no fixed price on the pricing page — the client contacts us). Compared with Free (₹9, 3-day trial) and Pro (₹59/month):

| | Free (₹9 trial) | Pro | **Agency** |
|---|---|---|---|
| Price | ₹9 for 3 days | ₹59/month (₹299 / 6mo, ₹599 / year) | **Custom — agreed per client** |
| Accounts | 1 of each platform | 5 of each | **Unlimited** |
| Client workspaces | — | — | **Unlimited** |
| White-label branding | — | — | **Yes** |
| Support | Standard | Priority | **Dedicated** |

The Agency client is typically an agency, freelancer or marketing company that manages **their own clients'** Instagram/Facebook/YouTube accounts and wants the tool to look like *their* product, not ours.

### What we offer (the pitch)

1. **The full platform** — DM & comment automation, publishing to Instagram/Facebook/YouTube, calendar, inbox, analytics, AI assistant, account health.
2. **Unlimited social accounts** — no per-platform cap.
3. **Unlimited client workspaces** — one workspace per end client, all managed from one login, with a workspace switcher.
4. **White-label branding** — their logo, brand name and colours replace ours in the app.
5. **Dedicated support** — a named contact channel with agreed response times (we define this per contract).
6. **Custom pricing** — usually a monthly retainer sized by number of end clients / message volume, or a per-seat model. Decide per client; minimum commitment recommended.

---

## 2. How white-label branding works in the app today

Branding is set **per workspace** by the workspace owner/admin under **Settings → Branding**:

- **Brand name** — shown in the sidebar header instead of "DM FB-IG-YT".
- **Logo link** (URL) — shown in the sidebar; falls back to the brand initial on a colour tile if the image fails to load.
- **Brand colour** (hex) — used for the sidebar logo tile and workspace chips.
- **Support email** — the support address we show/ship for that workspace.
- **Time zone** — reporting and scheduling reference for that workspace.

Each **client workspace** (created from the Agency owner's workspace via Settings → Client workspaces) is a separate organisation with its own branding, so every end client sees their own brand in their own workspace.

### What is white-labelled today vs. what still shows our brand

| Touch point | White-labelled? | Notes |
|---|---|---|
| Sidebar brand name, logo, colour | ✅ Yes | Per workspace |
| Workspace switcher names | ✅ Yes | Workspace/client names |
| Support email shown to end client | ✅ Yes | Per workspace |
| App URL / domain | ❌ Not yet | Runs on our domain (Lovable preview / Railway URL). A custom domain per client is a **future option** — needs per-tenant hosting work, do not promise it today. |
| Page titles / meta ("DM FB-IG-YT by Techaasvik") | ❌ Not yet | Browser tab titles still mention our brand |
| Login/signup pages | ❌ Not yet | Shared branded screens |
| Emails sent by the platform | ⚠️ Partial | Sender name/reply-to are configured by super admin; per-workspace sender identity is a future option and needs a verified sender domain |
| Underlying Meta / Google app | ❌ Never | The client's accounts connect through **our** registered Meta app and Google project — see section 7 |

Be upfront with clients about the domain and tab titles before signing. Do not oversell "fully white-labelled" until custom domains exist.

---

## 3. How we hand a client their white-labelled workspace (onboarding)

Step-by-step, as done today:

1. **Agree scope and price** — number of end clients, expected message volume, support level. Record in the signed agreement (section 5).
2. **Give the client an account** — they sign up, or we invite them via the team invite flow. They land in their workspace.
3. **Upgrade the workspace to Agency** — super admin sets the plan/billing for that workspace from the admin panel (Admin → Users / Organizations → plan override).
4. **Client connects accounts** — client (or we, on a call) connects their Instagram/Facebook/YouTube accounts under Social Accounts. Connection always goes through *our* Meta/Google app; the client may need to accept permissions on their side.
5. **Set branding** — client's owner/admin fills Settings → Branding (brand name, logo URL, brand colour, support email, timezone). Takes ~5 minutes.
6. **Create client workspaces** — from the Agency workspace, Settings → Client workspaces → add one workspace per end client. The Agency owner is automatically owner of each client workspace, so we can support them without extra invites.
7. **Set up automation rules per client** — copy (Duplicate button) a known-good rule into each client workspace, adjust keywords/links, turn on.
8. **Confirm safety limits** — per-workspace automation safety controls (hourly/daily limits, per-contact cap, quiet hours) are on by default; super admin can lock them per workspace.
9. **Walkthrough** — a test comment → public reply → opener DM → "Send me the link" tap → final link DM on one of the client's real posts, so the client sees the whole flow before going live.

Suggested handover pack (send as PDF/links): Terms of Service, Privacy Policy, Data Deletion instructions, quick-start guide, support email + hours, escalation contact.

---

## 4. Pricing the deal (guidance, not fixed rates)

We set the price per client. Anchors:

- **Floor:** the deal must stay above what the same client would pay as multiple Pro accounts, plus margin for white-label and dedicated support.
- **Common shapes:**
  - *Monthly retainer* per agency (e.g. covers N end-client workspaces, then per-extra-client fee).
  - *Per end-client workspace* monthly fee.
  - *Setup fee* for onboarding, brand setup and training — one time.
- **Renewal:** monthly or quarterly; annual gets a discount. Non-refundable after onboarding work starts (match the Terms).
- **Usage fairness:** Meta's own limits apply to everyone; we do not sell "unlimited DMs". Point clients to the safety limits (60/hour, 500/day defaults) and explain they exist to protect their accounts.

---

## 5. Legal documents (recommended before handing over white-label access)

Get a lawyer to draft/review these. Names and clauses below are the standard set:

1. **White-Label / Reseller Agreement** — the master document. It defines:
   - What the client may brand (name, logo, colours, support email) and what they may **not** brand (our Meta/Google app, source code, other customers' data).
   - Whether reselling is allowed and under what conditions (see section 8).
   - Term, renewal, termination, notice period, and what happens to client workspaces and data on exit.
2. **Terms of Service acceptance** — the end client accepts our platform Terms (the ones in the app) *in addition to* the white-label agreement.
3. **Data Processing Addendum (DPA)** — who is controller/processor for end-client data; DPDP Act (India) / GDPR (if any EU clients) obligations, breach notification, data deletion on exit.
4. **NDA** — if we share any internals (limits, roadmap, pricing logic).
5. **SLA / Support terms** — support hours, response time, what "dedicated support" includes (it does not include 24/7 or platform-wide uptime guarantees we cannot control — Meta API outages).
6. **Payment terms** — invoicing schedule, taxes (GST), late-payment and suspension clause (ties into super admin's suspend capability).

**Do not start onboarding before 1 + 2 are signed.** Keep signed copies in one place per client.

---

## 6. Our rights — what stays ours and how it's protected

Even after white-labelling, these remain ours:

1. **The platform itself.** The client rents access; they never receive source code, exports of the engine, or the right to self-host. The app always remains our software.
2. **The Meta app and Google project.** Social accounts connect through our registered Meta app (Tech Provider setup) and our Google/YouTube credentials. The client never gets our app IDs, secrets or webhook config. This is the strongest practical lock: if they leave, their automation stops because the API access layer is ours.
3. **The infrastructure.** Hosting (Railway), database, scheduler, webhook endpoints — all ours. Nothing runs on the client's servers.
4. **Brand rules.** The client may use *their own* brand inside the workspace. They may not use our name, logo, screenshots of our admin panel, or market "powered by Techaasvik" in either direction without permission.
5. **Right to suspend.** For non-payment, policy violation, or abuse that puts the platform or other customers at risk — we can suspend the workspace from the admin panel, per the contract.
6. **Right to limit.** Meta's own rate limits and platform policies apply on top of any plan; no white-label deal overrides them.
7. **Data ownership nuance.** The client owns *their* content and their end clients' message data (matches our Terms). We own the platform, aggregates and metadata needed to run and improve the service. Deletion on exit is handled per the DPA.

**How this is enforced technically today:** plan/suspension controls live in the super admin panel; tokens are stored server-side and never exposed to the client's browser; there is no export of rules/flows in a portable format. Contract enforces what code doesn't.

---

## 7. Can the client resell (sub-white-label)?

**Default answer: no, unless the agreement explicitly allows it.**

Why the default is no:

- A sub-reseller chain means people we never vetted operate through our Meta app — their behaviour (spam, policy violations) puts **our** app at risk of Meta restrictions, which would hit every customer.
- Support quality and billing become hard to control.

If a specific client genuinely needs to resell (e.g. a large agency with its own franchisees), allow it **only** with a written add-on: named sub-resellers, their volume, their acceptance of the same Terms, higher price, and our right to approve each sub-reseller.

### What the app does today about reselling

Honest picture of the current mechanics:

- Every client workspace created by an Agency workspace is linked via a **parent link** (`parent_organization_id`). The super admin's Organizations view can see each workspace and who owns it.
- **A client-workspace owner can currently create their own client workspaces too** — i.e. the app does not yet hard-block a second level. So contract + monitoring matter (below).
- Detection signals we can already use:
  - **Ownership chains** — organizations whose parent chain goes Agency → client → client's client show up in the Organizations list.
  - **Audit trail** — the super admin audit log records workspace creation, member and account changes; a workspace that suddenly creates many child workspaces is visible.
  - **Usage patterns** — a "single business" account that behaves like a hub (many connected accounts across many child workspaces, high message volume) stands out in admin views.

### How we track/stop unwanted reselling (recommended controls)

1. **Contract clause** — prohibit sub-reselling without written consent; breach = termination. This is the primary tool.
2. **Admin monitoring cadence** — super admin reviews Organizations weekly during onboarding months: look for child-workspace chains, new owners, unexpected account counts.
3. **Technical option (future, small change):** a super-admin toggle per workspace — "allow client workspaces" — so only approved Agency workspaces can create child workspaces. When a non-approved workspace owner tries, they see "Your plan doesn't include client workspaces."
4. **Alerting (future):** notify the super admin email when a workspace not flagged as Agency creates a client workspace.
5. **Branding watermark of truth:** our domain in the URL and our Meta app in the connection flow mean a sub-reseller's customers can always trace the real platform — a practical deterrent, not a control.

Until item 3 ships, **do not rely on the app to prevent reselling** — rely on the contract plus monitoring, and prioritise shipping the toggle before signing big Agency deals.

---

## 8. Exit / offboarding (what happens when the client leaves)

1. Written notice per contract; final invoice settled.
2. Super admin flips the workspace back to Free/expired limits or suspends it on the agreed date.
3. Data: export what the contract promises (contacts/reports), then delete per DPA timelines; confirm deletion in writing.
4. Their social accounts stay theirs — they can disconnect them anytime; our app simply stops touching them.
5. Their branding in our system is removed with the workspace or after the retention window.

---

## 9. Quick reference — do / don't when selling Agency

**Do**
- Get the white-label agreement + ToS signed before access.
- Set expectations about the domain and browser-tab titles.
- Onboard with a live end-to-end test on a real post.
- Keep safety limits on and explain why (account protection).
- Log every custom deal's price, scope and signed docs.

**Don't**
- Don't share admin panel access, tokens, secrets, or webhook URLs with clients — ever.
- Don't promise custom domains, per-workspace email senders or source code as part of today's plan.
- Don't let an unsupervised client turn into a reseller chain — watch Organizations and use the contract.
- Don't sell "unlimited DMs" — Meta's limits are not ours to sell.

---

## 10. Recommended pricing (INR) — what we would charge

Internal suggestion from the Techaasvik team. Nothing in this section changes the app's prices — the Plans editor (Admin → Plans) is the only place prices actually change. Update this section whenever we move a real price.

### 10.1 Self-serve plans

| Plan | Today | Recommendation | Why |
|---|---|---|---|
| Free trial | ₹9 for 3 days | **Keep ₹9 / 3 days** | Paid trial filters out tyre-kickers at almost zero friction. Keep the 1 Instagram + 1 Facebook + 1 YouTube limit. |
| Pro | ₹59/mo · ₹299/6mo · ₹599/yr | **Launch: keep ₹59** · Later: **₹99/mo · ₹499/6mo · ₹899/yr** | ₹59 is a no-brainer impulse price for the Indian market and beats every competitor (ManyChat runs ~₹1,300+/mo for similar automation; Indian WhatsApp tools like AiSensy start ~₹999/mo). But ₹59 barely covers infra + support per user. Once there are 100+ paying workspaces, move new signups to ₹99 and **grandfather existing ₹59 users** — they stay on ₹59 as long as they keep paying. |

**Timing for the ₹59 → ₹99 move:** only after the automation has been stable for 4–6 weeks and we have social proof (testimonials, case numbers). Announce 2 weeks in advance; grandfather everyone who joined before the change.

**Do not add a middle plan.** Three tiers (Free / Pro / Agency) is already the right ladder; a mid tier only creates upsell confusion at this stage. Revisit when the Pro plan has account-type limits that genuinely pinch (e.g. 10 of each platform as "Pro+").

### 10.2 Agency (custom pricing) — suggested ladder

Anchor rule from section 4 stands: the deal must stay above what the same client would pay as multiple Pro accounts, plus margin for white-label + dedicated support. Concretely:

| Tier | Included | Setup fee (one-time) | Monthly |
|---|---|---|---|
| Agency Starter | Up to 3 client workspaces, white-label branding, unlimited own accounts | ₹9,999 | **₹4,999/mo** |
| Agency Growth | Up to 10 client workspaces, white-label, priority onboarding call | ₹14,999 | **₹9,999/mo** |
| Agency Scale | Unlimited client workspaces, white-label, named support contact | ₹24,999 | **₹19,999/mo** |
| Extra client workspace (any tier) | Per additional workspace beyond the tier limit | — | **₹799/mo each** |

Notes:

- **Annual billing: 2 months free** (pay for 10, get 12) — same discount shape as Pro's yearly plan.
- **Minimum commitment: 3 months.** Setup fee is non-refundable once onboarding work starts (matches the Terms).
- **Never go below ₹3,000/mo total.** Below that the client should simply buy Pro seats — a custom deal under that number costs us more in support than it earns.
- **Do not price per message/DM.** Meta's rate limits are not ours to sell (section 4); volume-based pricing invites abuse and support fights. Price by number of client workspaces and support level.
- **Setup fee covers:** white-label brand setup, client workspace creation, automation rule copy + tuning, one live end-to-end walkthrough on the client's real post (section 3, step 9).
- **Dedicated support is included** in every tier; anything beyond agreed response times (e.g. 24/7 or a phone line) is a separate add-on priced per deal.
- **Reselling clause ties to price:** if a client wants sub-reseller rights (section 7), the add-on agreement starts at the Growth tier minimum — a client big enough to resell is big enough to pay for it.

### 10.3 Quick negotiation anchors

- Client asks "why not just Pro?" → Pro has 5-of-each account caps, no client workspaces, no white-label, standard support. Agency buys *their own product look* and unlimited structure.
- Client pushes on price → drop the tier (fewer included workspaces), never the per-workspace rate.
- Client wants annual → 2 months free is the ceiling; anything more needs a reason.
- Agency Starter at ₹4,999/mo = the price of roughly 12 Pro accounts; if the client needs fewer than 5 workspaces and doesn't care about branding, honestly tell them Pro is the better deal — that honesty wins the upgrade later.
