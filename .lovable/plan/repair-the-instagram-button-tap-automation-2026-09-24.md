# Repair the Instagram button-tap automation

## Goal
Make **“Send me the link”** reliably continue for both paths:

```text
Existing follower: comment → opener → tap → follow verified → final link DM
Non-follower:      comment → opener → tap → follow prompt → follow → confirm → final link DM
```

## Confirmed findings
- The public Railway webhook endpoint is reachable and correctly rejects an unsigned request.
- Current tests only verify payload parsing, button ordering, and verdict helpers; they do not run a complete signed webhook-to-final-DM flow.
- A Page-delivered Instagram tap can resolve to a Facebook account first. The gate handler then prefers that newly resolved account over the Instagram account stored on the gate, which can run the follow check and final send against the wrong account.
- The current event log collapses `messaging`, `standby`, and change-based postbacks into similar labels, making a missing tap indistinguishable from a tap rejected later in processing.
- Live Railway receipt remains unconfirmed from this workspace; the available preview logs belong to Lovable, not the Railway database.

## Implementation
1. **Bind taps to the original gate**
   - Resolve a payload-bearing tap by gate ID first.
   - Use the gate’s stored organization, Instagram account, rule, and conversation as the authoritative context.
   - Validate that the receiving Page/Instagram ID belongs to that same connected account instead of replacing it with an exact Facebook match.
   - Reject mismatched or stale gates with a visible activity reason.

2. **Normalize every Meta tap channel**
   - Handle `entry.messaging`, `entry.standby`, and `changes[].value` forms for postbacks and quick replies.
   - Preserve the real source channel and event field.
   - Generate a stable per-tap identity without colliding with the outbound opener message ID.

3. **Separate the two conversion branches**
   - Existing follower: atomically claim the waiting gate and send the final link DM immediately.
   - Non-follower or unavailable status: keep the gate waiting and send “Visit profile + I followed”.
   - “I followed” confirmation: re-check follow status, then atomically deliver once; retries remain bounded and duplicate webhook deliveries cannot double-send.

4. **Make every stop observable**
   - Record stages for raw tap received, account matched, gate found, follow result, follow prompt result, final DM result, duplicate, mismatch, and provider rejection.
   - Preserve Meta’s safe error code/message in activity so another silent failure cannot occur.

5. **Add end-to-end regression tests**
   - Signed Page `messaging_postbacks` payload for an existing follower.
   - Signed Page `standby` payload for a non-follower.
   - Instagram `changes[].value` quick-reply confirmation after following.
   - Both Facebook and Instagram rows connected to the same Page.
   - Duplicate delivery, missing gate, stale gate, unavailable follow status, and failed final send.
   - Assert database state transitions and exact outgoing Meta request payloads, not only helper return values.

6. **Validate and deliver**
   - Run focused tests and the project build; inspect current error logs.
   - Confirm no `.env`, tokens, or credentials are included.
   - Push only the tested source/test changes to `Vikashkumar2750/railway-ready-love`.
   - After Railway deploys, perform one fresh follower and one fresh non-follower test; the activity trail will identify the exact external failure if Meta still does not deliver a tap.

## Acceptance criteria
- A follower tap produces `tap received → follower verified → final DM delivered`.
- A non-follower tap produces `tap received → non-follower/unavailable → follow prompt sent`; confirmation after following produces the final DM.
- Duplicate taps send no duplicate final message.
- Every received tap has a terminal success, retry, or explicit failure entry.
- Tests pass, build is clean, and no credentials are committed.
