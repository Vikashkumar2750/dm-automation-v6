# Follow Gate button visibility and advanced All-in-One template

## Goal
Make the Flow Builder clearly show the complete follow-gate experience, and turn the All-in-One template into a stronger, practical comment-to-sale funnel.

## Verified current behavior
- The live flow runner already sends **two buttons** to non-followers: the editable **Visit profile** link and a fixed **I followed ✅** confirmation button.
- The Flow Builder card only renders fields for the message, Visit profile title and profile URL. It does not visually show the system-generated **I followed ✅** button, which is why it appears missing in the screenshot.
- The confirmation button is run-bound and triggers a fresh follow check; it is safer to keep its title and callback fixed rather than expose its technical action as a normal editable link.
- The current All-in-One template includes keyword filtering, public reply, Opening DM, follow gate, final details, tags, optional payment/coupon, a wait and basic contact capture. It does not yet provide a polished qualification and follow-up sequence.

## 1. Show the complete Follow Gate in the builder
- Keep **Visit profile** editable because it needs the creator’s profile URL.
- Add a visible, read-only **I followed ✅** button preview beside/below it, clearly marked as an automatic confirmation button.
- Add concise inline guidance that this button rechecks follow status and continues only after verification.
- Show both buttons in **Try it** for the non-follower outcome, including the waiting and verified-continuation states.
- Do not change the working rule builder, rule payloads or Meta account matching.

## 2. Upgrade the All-in-One template as a marketer-designed funnel
Create a clearer sequence for new copies of the template:

```text
High-intent comment keywords
  → suppress do-not-contact contacts
  → public acknowledgement
  → Opening DM: Send me the link
  → follow gate: Visit profile + I followed ✅
  → tag as engaged/follower lead
  → value-first offer/details DM with CTA
  → short lead-qualification form
      name, email/phone, primary interest, buying timeframe
  → tag as qualified/hot lead
  → optional payment link
  → optional personal coupon
  → timed objection-handling follow-up
  → avoid follow-up after paid-customer tag
  → tag for sales follow-up
```

- Use benefit-led, professional default copy rather than generic “here are the details” text.
- Keep payment and coupon steps switched off until the user selects a real product/campaign.
- Keep qualification and follow-up steps individually switchable, like every existing flow step.
- Stay within the current linear execution model: do not imply unsupported branching. Order checks so a failed condition stops only the intended later follow-up section.
- Update only future template copies; do not silently rewrite users’ saved flows.

## 3. Guidance and safeguards
- Update the Follow Gate help text and Automations guide to explain that **I followed ✅** is automatic and not a URL field.
- Keep follower verification fail-closed: unknown/non-follower results never release gated content.
- Preserve keyword-rule precedence, flow safety limits, takeover, quiet hours and duplicate-tap protection.

## Technical implementation
- Update the Follow Gate card and dry-run presentation in the Flow Builder route.
- Improve the `all_in_one` definition in the flow templates only; no database change is required.
- If needed, add a presentation-only outcome for the confirmation button; keep callback generation and live sending logic unchanged.
- Add focused tests asserting both follow buttons are represented and the new All-in-One order, safe defaults and disabled sales steps remain correct.

## Verification
- Confirm the editor visibly shows **Visit profile** and **I followed ✅** for every Follow Gate.
- Confirm Try it shows the non-follower wait, confirmation tap and verified continuation accurately.
- Confirm a new All-in-One copy has the advanced sequence, while an existing saved flow stays unchanged.
- Run flow, callback and automation regression tests and verify the Flow Builder in-browser.
- Real Instagram/Facebook delivery remains pending a deployed fresh-comment test; no reconnect or replacement of Meta flows will be performed.