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

## 3. Your questions
- **Safety rules** (hourly/daily limits, quiet hours): one set per workspace, shared by all connected accounts. That stays the recommendation, because Meta judges each account, but your plan limit counts the whole workspace.
- **Plan limits**: also apply to the whole workspace.
- **Usage & Limits**: by default it shows overall plan usage against the plan limit, with no filter. Below that, a per-account breakdown table shows each account's share of runs this month. This is information only and does not change the limits.

## 4. Guides
- Remove the ".md download" button from every guide.
- Remove the Meta App Review guide from what users can see, and remove any Meta App Review mentions from the other guides. The internal docs stay in the repo for us.

## Technical details
- New `PlatformAccountFilter` component built on the existing `AccountSelect`, which has a platform prop. It shows when 1+ platforms are connected. The account select keeps its rule of showing only with 2+ accounts.
- Filters are client-side on rows that already carry `platform` / `social_account_id`. Rules with no account (all accounts) stay visible under any account filter. No delivery or automation engine changes.
- Calendar fix: the filter currently compares `post.social_account_id`. Posts are grouped across accounts, so the filter will match on the post's account or group targets. This will be verified with real data.
- Per-account usage reuses `automation_runs` grouped by `social_account_id` (read-only), counted by run_key like `count_org_runs`.
- Templates come from existing `flow-templates` / rule templates and pass to `/automations/new` through a search param.
- No database changes.
