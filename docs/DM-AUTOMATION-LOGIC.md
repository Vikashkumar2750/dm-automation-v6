# DM Automation — How It Works (LOCKED)

Status: verified live for **followers** and **non-followers** (Sep 2026).
Before changing `src/lib/automation.server.ts` or `src/routes/api/public/webhooks.meta.ts`,
read this file and run `bunx vitest run`. All tests must stay green.

## 1. End-to-end flow

```text
User comments "keyword" on a post
        |
        v
Meta webhook (POST /api/public/webhooks/meta)
  - HMAC check with META_APP_SECRET (401 if mismatch -> NOTHING works)
  - dedupe, account match, trace row in webhook_events
        |
        v
Rule match (trigger=comment_received, keywords, target posts, safety settings)
        |
        +--> Public reply on the comment (comment_reply_text / variations)
        |
        +--> Private reply = OPENER DM (openGate stage "opener")
               text: "Thanks for your comment! 🙌 Tap the button below..."
               button: "Send me the link" (payload AUTOMATION_FOLLOW_CHECK:<gate>:opener:<nonce>)
               shapes tried in order (openerMessages):
                 1. attached button template + quick reply   <- visible in Message Requests
                 2. attached template only
                 3. quick reply only
        |
   user taps "Send me the link"
        v
Webhook: messages / messaging_postbacks / standby / quick_reply
  -> handleFollowGateReply (payload normalized from every format)
  -> atomic claim of gate (status=waiting + attempts)
  -> follow check via Graph API (is_user_follow_business)
  -> followGateVerdict(rule, follows, attempts)
        |
   +----+-----------------------------+
   | FOLLOWER                         | NON-FOLLOWER / unknown
   v                                  v
 deliver final DM (link/button/    FOLLOW PROMPT (stage "follow")
 attachment) -> gate completed       attached buttons in one bubble:
                                       [Visit profile]  (web_url to profile)
                                       [I followed ✅]  (postback confirm)
                                     fallback: quick-reply shape
                                          |
                                     user follows + taps "I followed ✅"
                                          v
                                     follow re-checked -> deliver final DM
                                     not yet following -> "We can't see your follow yet"
                                     (max MAX_GATE_TAPS = 4)
```

## 2. Key rules (do not break)

- Unknown follow status (null) is NEVER treated as follower -> ask_follow.
- Follower flow: opener tap delivers directly. No "I followed" step.
- Follow prompt uses `gateButtonMessages(text, buttons, false)` (template first).
- Opener uses `openerMessages` (template + quick reply together).
- A new comment expires older waiting gates for the same contact and logs
  `gate:tap_never_received` / `gate:follow_confirm_never_received`.
- One reply per person per POST (7 days): marker run `post_reply:<postId>`; a repeat on the
  same post logs `already_replied_on_post`. Comment cooldown and the per-contact DM cap are NOT
  applied to new comments, so other posts reply; org/rule rate limits and viral protection remain.
- Payload formats accepted: postback.payload, quick_reply.payload, standby, and
  text-only taps matching exact titles "Send me the link" | "Send it to me" | "I followed ✅".

## 3. Meta time windows

- Standard messaging window: 24 h after the user's last message/tap (resets each tap).
- Comment private reply: within 7 days of the comment, one private reply per comment.
- Non-follower DMs land in Message Requests — that's why buttons must be attached.

## 4. Safety limits (recommended)

- 60 automated DMs/hour and 200/day per account, 1 DM per person per comment,
  reply variations, viral guard. Meta publishes no fixed DM number; these are
  conservative values used by ManyChat-style tools to avoid spam flags.

## 5. Tracing / where to look when it breaks

- `webhook_events.error` = `trace:<id>:<reason>` (echo, duplicate_delivery,
  account_not_matched, unsupported_event, empty_body ...).
- `automation_runs` = each step with status + detail; friendly text in `src/lib/activity-explain.ts`.
- Delivery Health page shows live trace timeline; Test console simulates both flows without sending.

## 6. Troubleshooting checklist

1. Nothing at all -> webhook 401: META_APP_SECRET on Railway must equal the Meta app secret.
2. Opener arrives, tap does nothing -> run "Check & repair Meta" (subscribes messages,
   messaging_postbacks, standby); check Meta app webhook fields.
3. Activity says "tap never reached us" -> Meta didn't send the tap; same as step 2.
4. Follower gets follow prompt -> Graph follow check failed; reconnect account with all scopes.
5. Run `bunx vitest run` after any edit.
