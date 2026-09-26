# Facebook automation fix + Inbox scroll

Instagram flow (follower / non-follower) stays exactly as it is. All Facebook changes are behind a `platform === "facebook"` branch.

## What is confirmed from the screenshots + code

1. **Public reply on Facebook fails every time** — error `HTTP 400 · code 100 · subcode 33 · Unsupported post request` on the comment id. The code posts to `/{comment-id}/replies` for both platforms. `/replies` is the Instagram-only endpoint; Facebook needs `/{comment-id}/comments`. Same bug in the "Public reply only" action and in the Inbox manual reply path.
2. **Opener DM on Facebook works** ("Send me the link" reached Messenger), but after tapping it on Messenger (18:47) no tap event appears in Activity — so the Facebook tap is not reaching / not being matched. Root cause not yet confirmed.
3. Some later comments show "Tap to get it message rejected" — cause not yet confirmed (could be a repeated comment id or the Page-scoped user id).

## Plan

### 1. Facebook public reply (confirmed fix)
- Facebook comments → POST `/{comment-id}/comments` with the Page token.
- Instagram stays on `/{comment-id}/replies` (unchanged).
- Apply in: rule public reply step, "comment_public_reply" action, Inbox "Public reply".

### 2. Facebook "Send me the link" tap (investigate, then fix)
- First read the stored webhook events for the Page around the test time to see whether a `messaging_postbacks` / quick-reply event arrived for `object: "page"`.
- If it arrived but was ignored → fix mapping (Page id → connected account, Page-scoped sender id → open follow gate) in a Facebook-only branch.
- If it never arrived → make "Check & repair Meta" subscribe the Page to `messages` + `messaging_postbacks` and show it clearly in Account Health.
- Facebook has no follower check API, so on Facebook the tap goes straight to the final link/attachment DM (follow prompt is skipped on Facebook only).

### 3. "Tap to get it rejected" on Facebook
- Look at the exact Meta error text in those runs; fix the recipient format (`recipient: { comment_id }` via Page `/messages`) or mark the known Meta cause with a clear label.

### 4. Inbox chat scroll + sent messages look
- Thread area gets its own scroll box (fixed height), page does not grow; auto-scrolls to the newest message when opened / new message arrives.
- Sent messages shown like they actually look for the contact: "[public reply]" / "[private reply]" shown as a small tag instead of raw text, and the "Send me the link" / "Visit profile" / "I followed" buttons shown as button chips under the bubble.

## Safety
- Instagram code paths untouched; all existing tests must pass, plus new tests for Facebook reply endpoint and Facebook tap → final DM.
- Push to `Vikashkumar2750/railway-ready-love` (no `.env`).

## Test after deploy
Facebook: new comment → public reply visible + opener DM → tap → final link. Instagram: one follower + one non-follower comment to confirm still working.
