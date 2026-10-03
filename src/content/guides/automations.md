# Automations guide

All automations run in this order for every new comment or DM:

1. **Keyword rules** (simple mode) — always run first.
2. **Flows** (advanced mode) — only act when no rule replied.
3. **AI Agent** — only answers DMs when rules and flows stayed silent.

Safety limits, quiet hours, cooldowns and the daily cap apply to all of them.

## 1. Keyword rules
1. Open **Automations** and click **New rule**.
2. Pick the platform (Instagram, Facebook or both) and the trigger: comment, DM, story reply or story mention.
3. Add keywords separated by commas (e.g. `price, link`).
4. Choose the action: public reply, DM, or comment-to-DM. Add reply variations so messages don't look repeated.
5. Optional: follow gate — only followers get the link; others are asked to follow first.
6. Switch the rule **on** and save.

## 2. Flow builder
1. Click **Flow builder**.
2. Start from a **ready-made template** or press **+** for an empty flow.
3. Set the trigger, then add steps: *If contains*, *If follower*, *Send DM*, *Public reply*, *Wait*, *Add tag*.
4. Drag the steps (or use the arrows) to reorder. Flows run top to bottom; a condition that fails stops the flow.
5. Test in **Try it** — it never sends anything.
6. Replace example links (`example.com`) with yours, switch the flow **Active**, and press **Save all**.

## 3. Ice breakers & menu
In **Social Accounts → Ice breakers & menu**, pick a ready-made set or type your own questions, press **Save**, then **Sync to Meta**. To answer a question, create a *New DM* rule with the question as its keyword.

## 4. Activity
**Automations → Activity** shows every run, what was sent and why something was skipped.

## Tips
- Keep keywords short and specific.
- Use Wait steps for follow-ups instead of sending many messages at once.
- If nothing sends, check Activity for "skipped" reasons (cooldown, quiet hours, daily cap).
