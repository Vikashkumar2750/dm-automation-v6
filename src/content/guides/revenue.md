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

**How it works:** a simple page for your final link (like link-in-bio) with title, text and one button. Views and clicks are counted.
**How to use:** create the page, copy its link, and use it as the button link in any DM.

## 6. Payment reminder

**How it works:** if someone got a payment link but did not pay, one reminder is sent after the wait you set. Only one reminder per link, and only if the person messaged in the last 24 hours (Meta rule). Quiet hours, pause and limits still apply.
**How to use:** Payments setup → switch on → choose the wait (e.g. 120 minutes) and the message.

## 7. Sales report

**How it works:** shows the funnel for the last 30 days: DMs sent → page views → clicks → payment links → paid, plus total revenue.
**How to use:** open the **Sales report** tab to see the numbers; use them to see which step loses people.
