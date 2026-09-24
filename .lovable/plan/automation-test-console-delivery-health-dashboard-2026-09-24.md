# Automation Test Console + Delivery Health Dashboard

## Goal
1. Show exactly where each real tap stops, using live data, so the remaining failure can be seen instead of guessed.
2. Let you simulate follower and non-follower button taps from inside the app, running the real automation logic, without sending any real Instagram message.

## 1. Test Console (new page: Automations → Test console)
- Pick a rule, a connected account, and a scenario: **Follower**, **Non-follower**, **Unknown status**, **Duplicate tap**, **Old/expired button**.
- Buttons for each step: "Simulate comment", "Tap Send me the link", "Tap I followed".
- Each step runs the same webhook handler used in production, but in **dry-run mode**:
  - Outgoing Meta calls are captured, not sent.
  - The follow check returns the chosen scenario result instead of calling Meta.
- Shows a step-by-step timeline: event received → account matched → gate found → follower result → message that *would* be sent (exact text/buttons/link) → final gate status.
- Clear green PASS / red FAIL at the end: "Final link delivered" or "Stopped at: <reason>".
- Test records are tagged as test and hidden from normal activity and analytics; a "Clear test data" button removes them.

## 2. Delivery Health Dashboard (Account Health page, new section)
- **KPIs:** incoming event success %, outgoing message success %, active waiting gates, overall conversion %.
- **Incoming events:** counts by type (comment, message, button tap, standby) and status (processed, failed, ignored). A warning appears when openers are sent but zero taps arrive — that points to Meta settings, not code.
- **Outgoing results:** per step (comment reply, opener, follow prompt, final DM) with success and top failure reasons in plain words.
- **Retry history:** each gate with attempts 1–4, current state (waiting, completed, expired) and last reason.
- **Two funnels side by side:**
```text
Follower:     Comment -> Opener sent -> Tap -> Follower verified -> Final DM
Non-follower: Comment -> Opener sent -> Tap -> Follow prompt -> I followed -> Verified -> Final DM
```
  with drop-off at each step.
- Filter: Instagram / Facebook, last 24h / 7 days.

## 3. Validate and push
- Tests for dry-run mode (no real Meta request is ever made), both funnels, and dashboard counts.
- Run tests and build, then push only source/tests to `Vikashkumar2750/railway-ready-love`; no `.env` or credentials.
- After deploy: run the console for both scenarios. If the console passes but real taps still don't arrive, the dashboard will show "taps not received" — meaning Meta app setup (tester role, `messaging_postbacks` subscription, app live mode) must be fixed.

## Technical details
- Add a `dryRun` context to `automation.server.ts` (`callMessaging`, `checkFollows`, `sendChain`) that records requests into an in-memory list instead of calling Graph API.
- New server fn `runAutomationSimulation` (auth + org admin role) builds synthetic webhook payloads (quick-reply and postback shapes) and calls the same processing used by `webhooks.meta.ts`.
- Mark test rows via `webhook_events.provider = 'simulation'` and a `detail` prefix on `automation_runs`; exclude from existing lists/analytics.
- New server fn `getDeliveryHealth` in `webhooks.functions.ts` aggregating `webhook_events`, `automation_runs`, `automation_follow_gates` by org, platform, period.
- New route `src/routes/_authenticated/automations_.test.tsx`; dashboard section added to `account-health.tsx`; reasons via `explainReason`.
