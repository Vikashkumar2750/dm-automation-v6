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
**How it works:** a flow runs top to bottom on a zoomable canvas. A condition that fails stops the flow. A step switched **off** is skipped (not deleted). A *Follow gate* lets followers through and sends non-followers a **Visit profile** button — after they follow and tap **I followed**, verified followers continue.

**How to use:**
1. Click **Flow builder**.
2. Pick a template category (All-in-one, Sales, Lead capture, Followers, Engagement, Support) and click a template — or press **+** for an empty flow.
3. The **All-in-one** template is a complete comment-to-sale journey: keyword → opening DM → follow gate → two quick qualification questions → value message → offer page → optional direct payment/coupon → unpaid follow-up. Product, page, payment and coupon steps start off until you choose real items. Use each toggle to switch off what you don't need.
4. Add steps by group: **Conditions** (contains, does not contain, follower, non-follower, has/missing tag, email/phone known), **Actions** (DM, public reply, follow gate, wait), **Contacts** (add/remove tag, ask email/phone), **Sales** (payment link, coupon). Tags have one-click presets.
5. Zoom with the **+ / −** buttons or Ctrl + mouse wheel. Drag cards to position them; use the arrows to change execution order.
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

## Opening DM, canvas and "I followed" button

### How it works
- Comment templates start with an **Opening DM / Send me the link** step. Every matching commenter gets this button first. Only its tap continues to the follow check and the final content.
- Existing saved flows are not rewritten. Add Opening DM before follower checks and private-message steps to use this sequence; save the flow to generate the new run-bound confirmation buttons.
- Only the original recipient’s valid button tap resumes a waiting stage. Typed messages do not bypass the gate; stale, duplicate or cross-account taps cannot continue it. If follow status cannot be verified, the link stays withheld.
- Every step is a card on a free canvas. Lines connect the cards in the order they run. Where you place a card only changes the look, never the order.
- A follow gate sends two buttons: **Visit profile** and **I followed ✅**. Both are now visible in the builder and Try it. “I followed” is automatic and read-only because it safely binds the recheck to that person’s waiting flow. Followers continue; others get the request again (up to 2 more times).
- For forms, the best default is hybrid: ask at most two low-friction questions in DM, then put detailed contact fields on the offer page after the value is clear.

### How to use
- Drag a card by its title to move it. Drag empty space to move around. Ctrl + mouse wheel or the +/− buttons zoom. "Auto-arrange" puts every card back in neat rows.
- Use the up/down arrows on a card to change the run order.

- Templates and Try it results have independent scroll areas. Canvas wheel scrolling pans only the canvas; Ctrl/Cmd + wheel zooms around the pointer, and Ctrl/Cmd +/− works while the canvas is hovered or focused (not while editing fields).
- Activity separates **FLOW**, **Rule**, and **System / safety**; source and status filters stay selected when opening a run and returning.
- Live Instagram/Facebook button delivery must still be checked on a deployed connected account.
