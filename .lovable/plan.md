# Lock DM automation + publishing, admin control, pricing

## 1. Lock the working DM automation
- Freeze the current follower and non-follower flow: add regression tests covering every step (comment -> public reply -> opener -> tap -> follow check -> final link / follow prompt -> "I followed" -> final link). Any future change that breaks a step fails the checks.
- Add a "DO NOT CHANGE without running tests" header on the automation core.
- New document `docs/DM-AUTOMATION-LOGIC.md`: full flow diagrams, follower vs non-follower branches, Meta webhook formats (messages, postbacks, standby, quick replies), follow-gate states, 24h/7-day windows, tap limits, trace codes, activity reasons, and a troubleshooting checklist (401 signature, missing taps, Message Requests).

## 2. Non-follower second message
- Send the follow prompt as one message with attached buttons: "Visit profile" (opens the Instagram profile) and "I followed". Keep the current bottom-button version only as a fallback if Meta rejects it. Follower flow untouched.

## 3. Sidebar
- Remove "Contacts" from the sidebar (page stays reachable, just hidden).

## 4. Publishing fixes
- Add YouTube to the "all platforms" choice (YouTube upload via connected channel).
- Fix "media ID not found" when posting to Instagram + Facebook together: publish each platform with its own fresh media link, wait for Instagram processing, retry once.
- Add a "Publish now" button next to "Schedule" in the New Post window.
- Scheduled posts auto-publish: set up a timed job (every 5 minutes, ~288 runs/day) calling the existing publish endpoint, so posts go out within 5 minutes of the chosen time.
- Multiple posts to multiple platforms process in one batch, each tracked separately with its own success/failure.

## 5. Sending limits (safe defaults)
- Default per workspace: 60 automated DMs/hour, 200/day, max 1 DM per person per comment, small random delay between sends, reply variations on. Super admin can change per workspace.

## 6. Super admin full control
- Per user: suspend / unsuspend, force password reset email, reset password-reset limits, view and change plan / billing, extend or cancel plan.
- Per workspace: suspend, sending limits, plan override.
- Platform: block new registrations toggle, maintenance mode (non-admins see a maintenance page), password-reset limit (e.g. 3/hour per email).
- Email settings: super admin chooses which events send emails (signup, password reset, plan purchased / expiring, account suspended, automation paused, account disconnected) and edits sender name / reply-to.
- Plans editor: super admin edits plan names, prices, cycles, limits and perks; billing page reads from these.

## 7. Pricing
- Replace "Rs 9 lifetime" everywhere with "Rs 9 for 3 days trial"; the trial plan expires after 3 days.

## Technical details
- New tables: `plan_catalog`, `email_settings`, `password_reset_attempts`; new columns: `profiles.suspended_at`, `organizations.suspended_at`, registration/maintenance flags in `platform_settings`. All with grants + RLS (super-admin writes via `platform_roles`).
- Suspension enforced server-side in auth middleware checks and in the automation sender.
- Emails via Lovable Cloud email (needs a sender domain; I'll prompt for setup).
- YouTube upload needs YouTube scopes on the Google connection; the user may need to reconnect YouTube.
- Push to `railway-ready-love` main after tests pass; `.env` never committed.
