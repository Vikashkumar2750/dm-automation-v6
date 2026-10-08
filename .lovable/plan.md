# Delivery page: price, strike-through price, discount and coupon code

## What you will get
On the Revenue page, each delivery page gets a new optional "Price & offer" section:
- **Original price** (shown crossed out, e.g. ~~₹1,999~~)
- **Offer price** (shown big and bold, e.g. ₹999)
- **Discount badge** worked out by itself (e.g. "50% OFF"), with an option to type your own label instead
- **Coupon code** (e.g. SAVE50) shown in a box with a "Copy" button, plus an optional short note ("Use at checkout")
- A switch to show or hide the whole price box

If a product is linked to the page, its price fills the offer price by default, but you can change it. The live preview shows the price box as you type. On the public page it appears near the top, just above the main button, and again in the bottom button box.

## Rules
- Offer price must be lower than the original price, otherwise the crossed-out price and badge are hidden.
- Discount % is rounded to a whole number.
- Prices are in rupees; empty fields mean nothing is shown.
- The price shown here is for display only. The amount actually charged is still the product's price in the payment link, so the page warns you if the offer price differs from the linked product's price.

## Technical details
- Migration: add nullable columns to `delivery_pages`: `price_original_paise int`, `price_offer_paise int`, `discount_label text`, `coupon_code text`, `coupon_note text`, `show_price boolean default false`. GRANTs unchanged (existing table). Mirror in `docs/sql/fresh-database.sql`.
- `src/lib/delivery-page.ts`: pure helper `priceDisplay(original, offer, label)` returning formatted prices + discount %; tests in `delivery-page.test.ts` (e.g. 1999 → 999 = 50% OFF; offer ≥ original → no strike).
- `revenue.functions.ts`: accept/validate new fields with zod (coupon code A–Z/0–9/-, max 30 chars), return them from public page/offer loaders.
- `DeliveryPageView.tsx`: new price card (strike-through, offer, badge, coupon with copy) using design tokens.
- `revenue.tsx` form: new "Price & offer" section with info popovers, mismatch warning.
- Update revenue guide.
