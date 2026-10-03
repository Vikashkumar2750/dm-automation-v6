# Revenue guide

Sell inside Instagram / Facebook DMs, the way ManyChat does it.

## 1. Connect Razorpay (Payments setup tab)
1. Razorpay Dashboard → Account & Settings → API keys → copy **Key ID** and **Key secret**.
2. Razorpay → Webhooks → Add webhook. Paste the **webhook address** shown on the Payments setup tab, choose event **payment_link.paid**, and type any secret.
3. Paste Key ID, Key secret and that same webhook secret here → **Connect Razorpay**.
- Money goes straight to your own Razorpay account. Keys are never shown again.
- No Razorpay? Add your own payment link (UPI / Instamojo / any https link) on each product. Payments are then not confirmed automatically.

## 2. Products
Add a name and price. Turn a product off to stop new links.

## 3. Send a payment link from a flow
Flow builder → add step **Send payment link** → choose product. Each person gets their own link with a **Pay now** button.
When they pay: the link shows **Paid**, the contact gets the **paid** tag, and the sale appears in the Sales report.

## 4. Coupons
Create a campaign (e.g. prefix DIWALI, "20% off", max 500 codes, end date).
Flow builder → **Send coupon** step → message must contain `{code}`, e.g. "Your code: {code}".
Each person gets one unique code like DIWALI-7KQ2MX (asking again gives the same code).

## 5. Delivery pages
A simple page for your final link (like link-in-bio): title, text, one button.
Copy its link and use it as the button link in any DM. Views and clicks are counted.

## 6. Payment reminder
Payments setup → switch on → choose the wait (e.g. 120 minutes) and message.
Only one reminder per link, and only if the person messaged in the last 24 hours (Meta rule). Quiet hours, pause and limits still apply.

## 7. Sales report
Last 30 days: DMs sent → page views → clicks → payment links → paid, plus total revenue.
