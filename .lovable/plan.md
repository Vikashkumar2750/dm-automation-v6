# Lead form above the Register button, no separate Save button

## What changes
- The lead form moves inside the top section of the delivery page: right after the price box and directly above the main button (e.g. "Register now"). The bottom repeat button gets a small "Fill your details above" link back to the form instead of a second form.
- The "Save details" button is removed. The main button now does both:
  1. Checks the filled answers (required fields, email/phone/pincode format). If something is wrong, it shows the error under that field and does not open the link.
  2. Saves the lead, then opens the button link (payment / registration).
- If the form is "Optional" and the visitor leaves it empty, the button just opens the link. If they filled anything, it is saved first.
- If saving fails due to a network problem, the visitor still goes to the link (never blocked from paying) — except when a required field is invalid.
- Pages with a form but no button: a single "Submit" button stays (so leads can still be collected).
- Same behaviour on normal /p/ links, buyer offer links, and the Live preview (preview only validates, does not save).

## Not doing
- Auto-saving while typing (would save half-filled, spammy leads and hit the hourly limit). Saving happens once, on button click.

## Technical details
- `DeliveryPageView` gets an optional `form` slot rendered between PriceBox and CTA, plus an `onCtaClick` async hook; CTA anchor calls `preventDefault`, awaits hook, then `window.location.href = buttonHref`.
- `DeliveryLeadForm` becomes controlled-by-parent: exposes answers + `validate()` / `submit()` via a small hook (`useLeadForm`), no own submit button when a CTA exists.
- `p.$slug.tsx`, `o.$token.tsx`, `revenue.tsx` preview pass the form into the view instead of rendering it below.
- No server or database changes; existing `submitPageForm` / `submitOfferForm` reused. Update revenue guide text.
