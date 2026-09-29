# Professional YouTube comment automation

## Goal
Make YouTube comment handling reliable, contextual and inbox-first without changing the locked Instagram/Facebook automation paths.

## What will change
- Treat a video's `commentsDisabled` response as a normal per-video skip, not an account reconnect failure or breaking alert.
- Stop showing “Needs reconnect” for an expired short-lived YouTube access token when a valid refresh token can renew it; show reconnect only when refresh actually fails or authorization is revoked.
- Sync YouTube comments into the Unified Inbox even when no automation rule matches, and allow a public manual reply directly from the thread.
- Poll uploaded videos incrementally and safely, deduplicate comments, update unread counts, and keep disabled-comment videos from disrupting other videos.
- Generate a short, natural reply from each matched comment using the existing server-side Lovable AI gateway and the fixed model `openai/gpt-6-astra`.
- Keep links/instructions from the selected YouTube rule, avoid claims not supported by the comment, and reject empty/refused AI output.
- If AI is unavailable, rate-limited, blocked, or out of credits, send a polished deterministic fallback selected from the rule’s saved variations and intent-aware built-in templates.
- Enforce one automatic reply per commenter per video during the rule cooldown window, while retaining the existing one-reply-per-comment guard and manual-reply capability.
- Record clear activity reasons for disabled comments, AI fallback, duplicate ingestion, cooldown skips, token revocation and successful replies.

## Safety boundaries
- Keep YouTube polling/reply logic in its isolated module; do not modify Instagram/Facebook webhook, follow-gate, button or DM delivery code.
- Do not auto-reply to the connected channel’s own comments.
- Preserve workspace pause, feature flag, rule daily limit and explicit YouTube-only rule selection.
- Use bounded retry only for retryable AI failures; never retry provider denials/refusals or invalid requests.

## Verification
- Add focused YouTube tests for disabled comments, refreshable tokens, inbox deduplication, AI fallback and per-user/per-video cooldown.
- Run the existing full automation suite to prove Instagram/Facebook behavior remains unchanged.
- Make one live Lovable AI Gateway request and inspect the response before claiming AI replies work.
- Verify the live inbox can post a YouTube public reply and that no reconnect warning appears for a refreshable account.

## Technical details
- Store only synchronization state and non-secret authorization health; refresh/access tokens remain server-only.
- Use official YouTube Data API polling (`commentThreads.list`, `comments.insert`) and incremental cursors to control quota usage.
- Normalize YouTube comments into the existing conversations/messages model; no YouTube DM behavior will be added because the API does not support it.
