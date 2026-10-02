# Phase A — More entry points (safe, behind a switch)

Your existing Instagram/Facebook comment and DM automations stay exactly as they are. Everything new stays off until a Super Admin turns it on, so the Meta reviewer's account sees no change.

Note: keyword replies inside DMs already work (the "New DM" trigger). Phase A adds the missing entry points.

## What you get
1. **Story reply trigger**: someone replies to your Instagram story, and the rule sends a DM (keyword or any message).
2. **Story mention trigger**: someone tags you in their story, and the rule sends a thank-you or offer DM.
3. **Ice breakers**: up to 4 FAQ questions shown when someone opens your DM for the first time. Each question sends its own answer.
4. **Persistent menu (Facebook Messenger)**: an always-visible menu in the chat with links and quick answers.
5. **Super Admin switch**: "Phase A entry points", off by default. It can be turned on for everyone or for specific workspaces.

Live/ads-click entry points are left for later. They need extra Meta permissions that aren't part of the current review.

## Safety rules
- The comment-to-DM and follow-gate code doesn't change. New events take a separate path that runs only when the switch is on. Otherwise they are ignored as they are today.
- The same safety caps apply: hourly and daily limits, per-contact cooldown, quiet hours and the viral guard.
- Existing tests must still pass, and I'll add new tests that prove old rules behave exactly the same.
- No git push until you say so.

## Technical details
- New triggers `story_reply` and `story_mention` are added to the rule trigger options. There is no schema change, since `trigger` is text.
- The Meta webhook handler gets an early branch that detects `message.reply_to.story` or `attachments[type=story_mention]`. Only when the flag is on does it hand off to the new `entry-points.server.ts`. The current DM matching runs before and unchanged when the flag is off.
- Ice breakers are a postback payload `IB:<n>`, matched before the follow-gate payload parser. Unknown payloads fall through to the existing logic.
- Settings are stored in `platform_settings.feature_flags` (`entry_points_enabled`, `entry_points_orgs`). Per-account ice breakers and menu config are stored per workspace in the same settings JSON.
- A "Sync to Meta" button writes to the `messenger_profile` endpoint (Instagram `ice_breakers`, Facebook `persistent_menu` + `ice_breakers`). It is manual only and never runs automatically.
- UI changes: new trigger choices in the rule editor, and an "Ice breakers & menu" card on Social Accounts.
- AGENTS.md gets a rule: new entry points are isolated and gated by a flag.
