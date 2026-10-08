# Flow Builder: rule-style button sequence, separate activity and local scrolling

## Goal
Give comment flows the same customer-facing sequence as the working comment rules, without changing those rules. Keep templates, test results and canvas movement inside their own areas.

## Verified current behavior
- Working comment rules send an opener with **“Send me the link”** before checking follow status on the received tap. Their state is stored in `automation_follow_gates`.
- Flow Builder currently checks follow status at the follow-gate step without that opener. Its pending follow gates and lead forms use `flow_runs`.
- Flow logs use a `flow:` detail prefix in `automation_runs`. A missing rule ID alone does **not** identify a flow: rule-related gate and safety events can also have no rule ID.
- The templates and **Try it** results have no independent height-limited scrolling. Canvas wheel handling currently uses React `onWheel`, fixed zoom increments and no cursor-anchor adjustment.

## 1. Reuse the working opening-button experience, only for flows

Customer sequence:

```text
Matching comment
  → opener DM: “Send me the link”
  → customer taps; inbound message is recorded
  → follow status is checked
      follower → remaining flow steps / link
      not following or unknown → Visit profile + I followed ✅
  → confirmation tap → fresh follow check
      verified follower → resume remaining steps
      otherwise → bounded retry, never release gated content
```

- Add a visible **Opening DM / Send me the link** step to comment flows so its placement and pending state are understandable. Use it before follower checks and follow gates in the relevant ready-made templates, including All-in-one.
- Send the opener to both existing followers and non-followers. Do not check followers first and skip the consent tap for existing followers.
- Reuse the exported, working opener-message shapes and messaging/follow-check helpers by calling them; do not rewrite their rule implementations.
- Keep opener and confirmation stages in flow-owned pending state with distinct, run-specific payloads. Never write flow state into the rules’ follow-gate table.
- Resume from the saved point after the correct tap; preserve the original comment text for keyword conditions and use the incoming messaging identity for subsequent DMs and follow checks.
- Account for comment and DM conversations having different IDs, and Facebook/Instagram sharing a Page. A payload must resolve the originating flow run rather than guessing from the newest conversation.
- Do not silently rewrite saved active workflows. Existing saved flows retain their configuration; adding the opener is explicit. New templates include it where appropriate.
- Update **Try it** to show the opener, waiting-for-tap stage and follower/non-follower outcomes without sending messages. Update the guide and outdated “comment again” help text.

**Safety boundary:** leave the working rule engine, rule payload parser, rule follow-gate records, OAuth and subscriptions unchanged. If needed, add only a narrow flow-payload dispatch to the shared webhook, preserving the existing rule branch and its precedence. Flow continuation must obey current feature switches, takeover, quiet hours, caps and other safety checks. Duplicate, expired, wrong-stage and mismatched-account taps must not send twice or resume someone else’s run. Ordinary replies must not accidentally confirm an opener.

## 2. Separate FLOW and Rule recent activity

- Replace the mixed **Recent activity** list on Automations with two clearly named sections: **FLOW** and **Rule**, each with its own entries, empty state and View all action.
- Add the same source separation to the full activity page, alongside existing sent/skipped/failed filters. Keep the selected source when opening details and returning.
- Show flow names and meaningful step labels instead of “Safety settings” or “Deleted rule” for flow entries.
- Classify flow activity using the explicit `flow:` prefix, not `rule_id === null`. Keep unassigned safety/system events separate rather than falsely assigning them to a flow or rule.
- Apply source filtering before result limits so busy flows cannot hide recent rule entries, or vice versa. Preserve workspace authorization on every activity read.
- Preserve the dashboard’s general event timeline, but label flow versus rule run entries correctly so it does not misrepresent flow actions as rule actions.

## 3. Independent template and Try it scrolling

- Keep the saved-flow list and category filters above the template list.
- Give only the individual template list a bounded, independently scrollable area. Category filters stay accessible while browsing templates.
- Give **Try it** results their own bounded scroll area, keeping sample-message and follower/contact controls visible.
- Contain scroll at each panel’s edges so scrolling within it does not unexpectedly move the entire page. Adapt heights to available screen space; smaller screens must still allow normal page navigation outside these areas.

## 4. Canvas-only scrolling and zoom

- While the pointer is over the node area, ordinary wheel/trackpad scrolling pans only that area, never the surrounding page.
- **Ctrl + mouse wheel** and trackpad pinch zoom only the canvas around the cursor. Prevent browser/page zoom for these gestures inside the canvas.
- **Ctrl + + / Ctrl + −** zoom only the canvas while the pointer is inside it or the canvas itself is focused. Do not intercept typing inside a node’s input or text area, and restore normal browser behavior outside the canvas.
- Use delta-normalized, proportional wheel zoom with stable cursor anchoring; toolbar zoom uses the viewport center. Preserve the existing zoom range, saved node positions, dragging and Auto-arrange behavior.
- Use a native non-passive wheel listener with fresh state and proper cleanup, rather than relying on React’s passive wheel event. Keep touch interaction compatible and avoid global shortcut capture.

## Technical implementation
- Flow-only model, validation, dry-run, pending-state and template changes belong in `flows.*`, `flows-runner.server.ts` and `flow-templates.ts`.
- Reuse exported `openerMessages`, messaging and follower-check helpers without modifying their locked implementations.
- Add narrow flow callback parsing/resolution in a flow-owned module; pass the verified payload and incoming identity through the shared webhook only where required.
- Prefer existing `flow_runs` state storage. Verify its actual authorization and constraints before making any storage changes; no new schema is assumed necessary.
- Add a shared browser-safe activity classifier and authenticated source-filtered reads. Preserve legacy log readability; use structured flow identification for new entries where supported.
- Implement bounded scroll containers and canvas-local event handling in the Flow Builder presentation code. Avoid an unrelated node-editor rewrite or changes to execution order.
- At implementation start, record these tasks in `roadmap.md`; update architecture notes and the Automations guide when complete.

## Verification and completion criteria
- Regression tests: opener always precedes follower checks for the opted-in comment flow; follower delivers after tap; non-follower receives the follow prompt; unknown follow status does not release the link; verified confirmation resumes once.
- Test run/account/contact binding, different comment-versus-DM identities, duplicate/expired/wrong-stage taps, paused flows, takeover, keyword-rule precedence and pending lead-form compatibility.
- Activity tests prove `flow:` entries stay out of Rule results and null-rule safety events are not classified as FLOW. Test filtering before limits.
- Run existing rule, flow and messaging tests. Confirm no locked rule behavior changes.
- Browser checks: long template/test-result lists scroll internally; canvas wheel does not move the page; Ctrl-wheel and Ctrl +/− affect only the canvas; cursor anchoring, node dragging and saved positions remain stable.
- Real Instagram/Facebook delivery remains **unverified** until deployed and tested using fresh comments and real taps. Report this limitation explicitly; automated tests are not a substitute for Meta delivery evidence.