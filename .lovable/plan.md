# AutoDM Master Plan (Nov 2026)

Covers everything discussed: Super Admin per-workspace control, delivery page coupons, UI consistency, homepage visuals, converter (800 MB + cleanup), emails/outreach, and a saved document. Locked Meta delivery flows, rule engine and workspace data separation stay untouched.

## 1. Super Admin: per-workspace control (Super Admin → Organizations → open a workspace)

New "Features & access" panel per workspace. Each switch can be "Use platform default" or an override:

| Feature | Options |
|---|---|
| Sales & Revenue | Enabled / View only / Hidden |
| Create Post | Enabled / Coming soon / Hidden |
| Calendar | Enabled / Coming soon / Hidden |
| AI assistant + AI agent | Enabled / Off, plus monthly AI request cap |
| Workflows | Enabled / Off |
| Team Desk | Enabled / Off (kept, default on) |
| Growth Insights | Enabled / Off (kept, default on) |
| WhatsApp OTP on lead forms | Enabled / Off |
| Delivery pages | Enabled / Off |
| Emails to buyers/leads | Enabled / Off |

Order of rules: platform switch → plan → workspace override (override wins, except platform-wide maintenance/pause).

Also on the same page:
- Existing panels stay: plan + duration, pause automations, plan limits, safety caps, test console.
- New "Workspace health" panel: connected accounts + token expiry, Razorpay connected/webhook status, WhatsApp OTP status, last 10 errors, leads count (completed/dropped), paid orders count and revenue total. Read-only summary; no message contents shown.
- Overrides enforced in server code too (not only hidden in menus), so a hidden feature cannot be used by calling it directly.
- User menu and pages read the merged result, so a Super Admin change shows on the user's next page load.

## 2. Delivery page coupons

- Coupon box on page: "Have a coupon code?" input + Apply. Copy button removed.
- Auto-apply: if the page has a linked coupon, or the link has `?coupon=CODE` (for DMs/comments), it is applied on load and shown as a green "CODE applied (−₹X)" chip with Remove.
- Manual: any active coupon of that workspace (created in Sales & Revenue → Coupons) can be typed and applied; clear messages for invalid/expired/used-up.
- Discount is taken from the maximum price (MRP), not the selling price. Example: MRP ₹2,999, selling ₹999, 20% coupon → ₹599.80 off MRP → payable ₹2,399.20. **Rule: final price = MRP − coupon discount (never below ₹1).** With no coupon the buyer pays the selling price. If a coupon total comes out higher than the selling price, the page warns the creator while editing the coupon. Flat coupons work the same way.
- Price box shows: MRP → coupon → GST → processing fee → total.
- Checkout re-checks the coupon on the server and creates the Razorpay link for the exact total; usage count goes up only after payment. Receipt shows coupon used.

## 3. UI consistency on every page and sub-page

One shared set of styles used everywhere (user dashboard, Super Admin, public pages):
- Page title: large bold (≈30px desktop / 24px mobile) with one-line description under it.
- Section title: ≈20px semibold, optional icon, clear gap above.
- Card title: ≈16px semibold; helper text 14px muted; labels 14px medium.
- Spacing: same page padding, same gap between sections and cards on every page.
- Long settings forms (delivery page editor, product form, settings) split into titled cards: Pricing & tax, Coupons, Social links, Creator & support, What you'll get, Policies.
- Team Desk and Growth Insights kept and restyled to match.
- Menu: group items under clear headings (Engage, Sell, Publish, Team, Settings) without removing any page.

## 4. Homepage visuals

- Generated product visuals: comment → DM → delivery page → payment → access flow, plus Instagram/Facebook/YouTube automation preview, delivery page + buyer portal mockup, inbox/contacts view.
- Visual sections with images instead of text-only blocks, keeping current copy, FAQs, SEO tags.
- Images converted to WebP and lazy-loaded so page speed stays good.

## 5. Free WebP/WebM converter

- Limit raised from 200 MB to 800 MB per file (shown on the page).
- Progress bar per file and a warning for very large videos (they take about as long as the clip).
- Storage/cleanup: this public tool converts inside the visitor's own browser; files are never uploaded or saved on our server or database. After download, the converted copy is cleared from the browser memory immediately, and a "Clear all" button is added.
- Super Admin cleanup: Media Library gets "Delete converted/temporary files older than 7 days" (manual button) plus an automatic daily cleanup for any temporary converter files, so nothing piles up if storage is used in future.

## 6. Emails (automatic + outreach)

Uses the existing email sender (Resend settings already in backend) with branded templates:
- Buyer payment receipt: product, amount, GST/fee breakdown, coupon, payment ID, "Access your content" button. Sent once per payment.
- Lead form confirmation: "Thanks, here is your link / what happens next".
- Creator alert: new sale and new lead email to the workspace owner (can be switched off).
- Outreach from Contacts: select dropped/partial leads → AI draft (already exists) → "Send email" one by one per lead, logged as Follow-up sent. One recipient per send, no bulk blasts (protects deliverability).
- Super Admin can switch emails per workspace (section 1) and test-send (already exists).

## 7. Documents
- This plan kept in the project and a full copy saved to Files as `AutoDM_Master_Plan.md`.

## Build order
1. Converter 800 MB + cleanup
2. Coupon engine + checkout
3. Super Admin per-workspace features + health panel
4. Emails (receipt, lead confirmation, creator alert, outreach send)
5. Shared UI styles applied page by page
6. Homepage visuals
7. Tests for coupon maths, feature overrides, converter limit

## Technical notes
- Overrides stored in `platform_settings.feature_flags` under `org_features_<orgId>` (no schema change); resolver in `src/lib/workspace-features.ts`, used by `getPlatformStatus`-style server fn, AppShell, page gates and server functions.
- Coupon validation in `revenue.server.ts` (`validateCoupon`), public server fn for page preview; `pay.$slug.ts` accepts `coupon`; redemption increment in webhook/paid callback with the existing created→paid guard.
- Converter: `MediaConverter.tsx` limit constant 800 MB, `URL.revokeObjectURL` after download; admin cleanup server fn removes `media_assets` rows + storage objects older than 7 days with kind "temp"; daily cron via existing cron secret pattern.
- Emails via `support-email.server.ts`, idempotent per payment/lead id.
- Typography via shared `PageHeader`/`Panel`/new `SectionHeader` primitives instead of per-page classes.
