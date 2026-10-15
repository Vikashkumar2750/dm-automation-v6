# Platform + Account filters everywhere, dashboard upgrades, guide cleanup

## 1. One shared filter bar: "All platforms" + "All accounts"
A single reusable filter row (platform dropdown, then account dropdown). The account list only shows accounts of the selected platform. Changing the platform resets the account to "All accounts". Both stay on one line on desktop and wrap neatly on mobile.

Applied to:
- **Create Post – Your posts**: add the account filter next to the existing platform filter.
- **Calendar**: fix the filter so it actually filters the calendar, add a platform filter, and put the filters, Today and New post buttons on one line.
- **Inbox**: add the platform filter next to the account filter.
- **Automations**: filter rules by platform and account. Same for Recent Activity and the Flow Builder "All flows" list.
- **Contacts, Analytics, Growth Insights**: platform + account filters.
- **Sales & Revenue**: suggested: account filter only, applied to payment links and sales. Totals show a note when "All" is selected. No separate platform filter, because sales are tied to the account the DM came from.
- **Team Desk**: suggested: platform + account filter on the chat queue only. Team settings stay workspace-wide.

## 2. Dashboard
- Replace "Create post" with **Create new automation**, which opens the new automation page. If no social account is connected, a popup says "Connect an account first", with a button that goes to Social Accounts.
- New first card: **Automation templates**. Up to 4 cards are visible at a time. If there are more, they show in a slider you can move with the mouse wheel, arrow buttons, or touch swipe. Clicking a template opens the new automation page with that template filled in.

## 3. Limits: what counts per account, what counts for the whole workspace

### Final recommendation
| Limit | Applies to | Who sets it |
|---|---|---|
| Monthly automation runs (plan quota) | Whole workspace, shared by all accounts | Plan (Super Admin can override) |
| Active rules / flows | Whole workspace | Plan (Super Admin can override) |
| Number of connected accounts | Whole workspace (Pro: 5 per platform) | Plan |
| DMs per hour | Each account separately | User, up to the Super Admin max |
| DMs per day | Each account separately | User, up to the Super Admin max |
| Burst (DMs per minute) + cooldown | Each account separately | Fixed by the system |
| Journeys per contact per day | Each account separately | User, up to the Super Admin max |
| Quiet hours | Each account (copied from the workspace default) | User |

Why: Meta counts and flags each account on its own, so safety limits should be per account. Billing is per workspace, which is also how ManyChat and LinkDM sell, so the plan quota stays shared.

### Calculations (Pro: 10,000 runs/month, up to 15 accounts)
- **Per-account default:** 60/hour and 500/day.
  - One account could reach 500 × 30 = 15,000/month, which is more than the whole Pro quota. So the plan quota is the real ceiling, and nobody gets more than they paid for.
- **Today (one shared cap):** 3 accounts share 60/hour. If one viral post uses all 60, the other two send 0 that hour.
  - With per-account caps, each account gets 60, so up to 3 × 60 = 180/hour and no account blocks another.
- **Average need:** 10,000 / 30 ≈ 333 runs/day for the whole workspace, so 500/day per account leaves plenty of headroom.
- **Starter (300 runs/month):** about 10/day. The plan quota does all the limiting.

### Safety settings on the user dashboard + Super Admin max values (new)
Keeping safety settings on the user dashboard is right, because users need quiet hours and a way to slow down a new account. But they can only choose values up to a max that Super Admin sets:

| Setting | Default | Max a user can set |
|---|---|---|
| DMs/hour per account | 60 | 150 (below Meta's ~200/hour) |
| DMs/day per account | 500 | 1,500 |
| Journeys/contact/day | 3 | 5 |

- **Admin → System Settings:** the max values for all workspaces.
- **Admin → Workspace detail → Safety (new):** override for one tenant. Lower it for a new or flagged tenant, raise it for a trusted agency. Even then, 200/hour is a hard stop.
- The user sees "Max allowed: 150" next to each field. The server also rejects higher values, so the max can't be bypassed from the screen.
- Optional, later: a per-account monthly cap for agencies reselling to clients.

### Usage & Limits page
- **Top (default, no filter):** overall plan usage, for example 4,200 / 10,000 runs (42%).
- **Below:** one row per account with runs this month, its share of the plan, and today's usage against that account's caps (for example 38/60 this hour, 210/500 today). Rows turn amber at 80% and red at 100%.
- Contacts already in the middle of a journey are never cut off. Limits only block new journeys, same as today.

## 4. Guides
- Remove the ".md download" button from every guide.
- Remove the Meta App Review guide from what users can see, and remove any Meta App Review mentions from the other guides. The internal docs stay in the repo for us.

## Technical details
- New `PlatformAccountFilter` component built on the existing `AccountSelect`, which has a platform prop. It shows when 1+ platforms are connected. The account select keeps its rule of showing only with 2+ accounts.
- Filters are client-side on rows that already carry `platform` / `social_account_id`. Rules with no account (all accounts) stay visible under any account filter. No delivery or automation engine changes.
- Calendar fix: the filter currently compares `post.social_account_id`. Posts are grouped across accounts, so the filter will match on the post's account or group targets. This will be verified with real data.
- Per-account usage reuses `automation_runs` grouped by `social_account_id` (read-only), counted by run_key like `count_org_runs`.
- Templates come from existing `flow-templates` / rule templates and pass to `/automations/new` through a search param.
- Per-account safety: the safety gate scopes its counters by `social_account_id`. It only reads that account's limit, and the locked delivery order stays the same.
- Per-account overrides: a JSON map on the workspace trust settings (one small column addition).
- Super Admin max values: stored in `platform_settings.feature_flags` (global `safety_caps` plus `safety_caps_<orgId>`), the same pattern as `plan_limits_<orgId>`. Values are clamped on save and again in the safety gate.
- Tests: two accounts keep separate counters, a user value above the max is clamped, and the per-tenant override wins over the global value.
