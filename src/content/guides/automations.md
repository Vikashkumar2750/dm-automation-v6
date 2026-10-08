# Automations guide

## How it works
All automations run in this order for every new comment or DM:

1. **Keyword rules** (simple mode) — always run first.
2. **Flows** (advanced mode) — only act when no rule replied.
3. **AI Agent** — only answers DMs when rules and flows stayed silent.

Safety limits, quiet hours, cooldowns and the daily cap apply to all of them. Nothing sends while an account is auto-paused by the rate-limit guard.

## How to use

### 1. Keyword rules
1. Open **Automations** and click **New rule**.
2. Pick the platform (Instagram, Facebook or both) and the trigger: comment, DM, story reply or story mention.
3. Add keywords separated by commas (e.g. `price, link`).
4. Choose the action: public reply, DM, or comment-to-DM. Add reply variations so messages don't look repeated.
5. Optional: follow gate — only followers get the link; others are asked to follow first.
6. Switch the rule **on** and save.

### 2. Flow builder
**How it works:** a flow runs top to bottom on a zoomable canvas. A condition that fails stops the flow. A step switched **off** is skipped (not deleted). A *Follow gate* lets followers through and sends non-followers a **Visit profile** button — when they follow and comment again, the flow continues.

**How to use:**
1. Click **Flow builder**.
2. Pick a template category (All-in-one, Sales, Lead capture, Followers, Engagement, Support) and click a template — or press **+** for an empty flow.
3. The **All-in-one** template has every step ready (keyword → follow gate → DM → payment → coupon → ask email/phone). Use each step's toggle to switch off what you don't need.
4. Add steps by group: **Conditions** (contains, does not contain, follower, non-follower, has/missing tag, email/phone known), **Actions** (DM, public reply, follow gate, wait), **Contacts** (add/remove tag, ask email/phone), **Sales** (payment link, coupon). Tags have one-click presets.
5. Zoom with the **+ / −** buttons or Ctrl + mouse wheel. Drag steps or use the arrows to reorder.
6. Test in **Try it** (set follower, existing tags, saved email/phone) — it never sends anything.
7. Agency plan: **AI suggest flow** builds or improves a flow (1 per day). It is added as a draft.
8. Replace example links (`example.com`, `instagram.com/yourprofile`) with yours, switch the flow **Active**, and press **Save all**.

### 3. Ice breakers & menu
In **Social Accounts → Ice breakers & menu**, pick a ready-made set or type your own questions, press **Save**, then **Sync to Meta**. To answer a question, create a *New DM* rule with the question as its keyword.

### 4. Activity
**Automations → Activity** shows every run, what was sent and why something was skipped.

## Tips
- Keep keywords short and specific.
- Use Wait steps for follow-ups instead of sending many messages at once.
- If nothing sends, check Activity for "skipped" reasons (cooldown, quiet hours, daily cap).
