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
  → short in-DM qualification
      primary interest + buying timeframe
  → tag as qualified/hot lead
  → value-first offer DM with delivery-page CTA
  → product-specific delivery page with payment CTA
  → personalized payment link
  → optional personal coupon
  → timed objection-handling follow-up
  → avoid follow-up after paid-customer tag
  → tag for sales follow-up
```

- Use benefit-led, professional default copy rather than generic “here are the details” text.
- Add an **Offer / delivery page** message before payment so the buyer can understand the product, benefits, proof, FAQ and guarantee before paying.
- Keep product, delivery-page, payment and coupon steps switched off until the user selects or creates the required real item.
- Allow the relevant step to create a product or delivery page without leaving Flow Builder, then select it automatically. Reuse the existing in-place product pattern instead of duplicating a second catalog.
- Provide a delivery-page starter specifically for this funnel, with product name, outcome-led H1, benefits, what is included, proof/assurance, FAQ and a clear payment CTA. The user can edit all copy.
- Keep the buyer-specific payment URL separate from the public page’s static content. The flow creates the customer’s payment link first and uses a narrowly scoped, unguessable offer URL so that the page CTA opens that exact payment link; never put customer identity or payment credentials in the URL.
- Keep qualification and follow-up steps individually switchable, like every existing flow step.
- Stay within the current linear execution model: do not imply unsupported branching. Order checks so a failed condition stops only the intended later follow-up section.
- Update only future template copies; do not silently rewrite users’ saved flows.

## 3. Form placement recommendation
Use a **hybrid funnel**, not one large form in the middle of the DM automation.

- In DM, ask at most **two low-effort, multiple-choice questions**: primary interest and buying timeframe. This gives useful segmentation while preserving momentum and works naturally in chat.
- Do not ask name, email and phone before showing the offer by default. The social profile already identifies the conversation, and premature personal-data requests add friction.
- Put the **detailed optional form on the delivery page**, after the product value is clear. Use it for email/phone, business details or custom fields only when they are genuinely needed for fulfilment, consultation or follow-up.
- For an immediate-purchase product, make the page form optional/skippable and keep **Pay now** prominent. For a high-ticket/service offer, require only the fields needed to qualify or fulfil before revealing/enabling the next CTA.
- Save delivery-page form answers through the existing CRM field model with explicit consent text. Never overwrite an existing email or phone automatically.
- Record separate funnel events for offer-page view, form start, form completion, payment-link click and paid so the user can see where buyers drop off.

**Why this is best:** a long in-DM form delays the offer and increases abandonment; a page-only form loses conversational qualification. Two quick DM answers plus a well-designed page balances conversion, lead quality and measurable intent.

## 4. Guidance and safeguards
- Update the Follow Gate help text and Automations guide to explain that **I followed ✅** is automatic and not a URL field.
- Keep follower verification fail-closed: unknown/non-follower results never release gated content.
- Preserve keyword-rule precedence, flow safety limits, takeover, quiet hours and duplicate-tap protection.

## Technical implementation
- Update the Follow Gate card and dry-run presentation in the Flow Builder route.
- Improve the `all_in_one` definition and add the product/delivery-page setup controls used by its offer sequence.
- Reuse existing products, delivery pages, CRM custom fields and payment-link creation. Add only the narrow association/token storage needed for a buyer-specific delivery-page payment CTA; verify the existing schema and authorization before choosing the migration shape.
- Validate delivery-page submissions and payment resolution on the server, bind short-lived/unguessable offer tokens to the workspace and generated payment link, and never expose payment credentials.
- If needed, add a presentation-only outcome for the confirmation button; keep callback generation and live sending logic unchanged.
- Add focused tests asserting both follow buttons are represented; the new All-in-One order and disabled sales steps are correct; form requirements are enforced; and an offer token cannot access another workspace/customer payment link.

## Verification
- Confirm the editor visibly shows **Visit profile** and **I followed ✅** for every Follow Gate.
- Confirm Try it shows the non-follower wait, confirmation tap and verified continuation accurately.
- Confirm a new All-in-One copy has the advanced sequence, product and delivery-page setup, while an existing saved flow stays unchanged.
- Confirm the delivery page presents the product professionally, saves allowed form fields, and opens only the buyer’s bound payment link.
- Confirm both fast-purchase (form skipped) and high-ticket (required fields) configurations work without a dead end.
- Run flow, callback and automation regression tests and verify the Flow Builder in-browser.
- Real Instagram/Facebook delivery remains pending a deployed fresh-comment test; no reconnect or replacement of Meta flows will be performed.