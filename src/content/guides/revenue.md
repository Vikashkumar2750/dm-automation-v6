# Revenue guide

Sell inside Instagram / Facebook DMs, the way ManyChat does it.

## 1. Connect Razorpay (Payments setup tab)

**How it works:** money goes straight to your own Razorpay account. Razorpay tells this app when a payment is done (via the webhook), so the contact gets the **paid** tag and the sale appears in the report. Keys are stored securely and never shown again.

**How to use:**
1. Razorpay Dashboard → Account & Settings → API keys → copy **Key ID** and **Key secret**.
2. Razorpay → Webhooks → Add webhook. Paste the **webhook address** shown on the Payments setup tab, choose event **payment_link.paid**, and type any secret.
3. Paste Key ID, Key secret and that same webhook secret here → **Connect Razorpay**.

No Razorpay? Add your own payment link (UPI / Instamojo / any https link) on each product. Payments are then not confirmed automatically.

## 2. Products

**How it works:** each product is a name + price that payment-link steps offer to buyers.
**How to use:** add a name and price. Turn a product off to stop new links.

## 3. Send a payment link from a flow

**How it works:** the flow step creates a personal link for each person with a **Pay now** button. When they pay, the link shows **Paid**, the contact gets the **paid** tag, and the sale appears in the Sales report.
**How to use:** Flow builder → add step **Send payment link** → choose product.

## 4. Coupons

**How it works:** each person gets one unique code like DIWALI-7KQ2MX (asking again gives the same code).
**How to use:**
1. Create a campaign (e.g. prefix DIWALI, "20% off", max 500 codes, end date).
2. Flow builder → **Send coupon** step → message must contain `{code}`, e.g. "Your code: {code}".

## 5. Delivery pages

**How it works:** a professionally formatted offer or delivery page with a headline, benefits, proof, FAQ and repeated action button. You can show a product image, set one real fixed deadline, and choose whether an expired button is hidden or disabled. Flow offer pages bind the Pay now button to that buyer’s personal payment link instead of exposing payment details in the page address. Views, form completion and clicks are counted.

**How to use:**
1. Start from a ready-made design or write with `#` headline, `##` sections, bullets, notes and FAQs.
2. Optionally upload a product image and switch **Show product image** on or off.
3. Optionally choose a real end date/time and expiry behaviour. The timer never resets per visitor.
4. Choose no form for fast purchases, optional form for normal lead capture, or required form only when fulfilment genuinely needs the detail.
5. In Flow Builder, add **Offer / delivery page**, choose the product and page, then switch the step on. The flow creates a buyer-bound page link automatically.

**Recommended form setup:** ask only one or two multiple-choice questions in DM. Put longer contact/custom fields on the page after the buyer understands the offer. This keeps momentum without losing useful lead data.

## 6. Payment reminder

**How it works:** if someone got a payment link but did not pay, one reminder is sent after the wait you set. Only one reminder per link, and only if the person messaged in the last 24 hours (Meta rule). Quiet hours, pause and limits still apply.
**How to use:** Payments setup → switch on → choose the wait (e.g. 120 minutes) and the message.

## 7. Sales report

**How it works:** shows the funnel for the last 30 days: DMs sent → page views → clicks → payment links → paid, plus total revenue.
**How to use:** open the **Sales report** tab to see the numbers; use them to see which step loses people.

## Price, coupon, lead form and editing (delivery pages)

**How it works:** A delivery page can show a price box (original price crossed out, offer price, automatic "% OFF" badge and a copyable coupon code) and a lead form (Email only, or a full form with Name, Phone, Email, Pincode and your own text/dropdown fields). Form answers from normal page links are listed under the page's **Leads** button; answers from buyer offer links also update the contact.

**How to use:**
1. Revenue → Delivery pages → switch on **Price & offer**, type the original and offer price, optionally a coupon code.
2. Pick **Lead form** → Email only or Full lead form, switch fields on/off and mark them required.
3. Check the **Live preview**, then Save. Use the pencil icon on any saved page to edit it — keep the address the same so old DM links keep working.
