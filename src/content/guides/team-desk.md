# Team desk guide

Team desk is for teams and agencies. Open it from **Team desk** in the left menu.

## 1. Shared inbox
- Every conversation shows who it is **assigned to**. Pick a teammate from the dropdown to assign it.
- Filter **Mine** to see only your chats, or **Unassigned** to pick up new ones.
- Write a reply in the box and press **Send** (or **Send for approval** if you are an agent and approval is on).

## 2. Approval queue
- Owners, admins and managers can switch on **Agents need approval**.
- After that, agents cannot send DMs directly — their reply goes to the **Approvals** tab.
- A manager presses **Approve & send** (the DM goes out) or **Reject** with a short note.
- Meta's 24-hour rule still applies: approve quickly, or the reply can't be sent.

## 3. Client reports
- Shows every workspace you belong to (your own + client workspaces) for the last 7/30/90 days: messages in, replies out, automation runs, active chats, plan and plan expiry.
- **Download CSV** to share a report with a client or to bill them.

## 4. API & webhooks (managers and above)
- **API key**: create one, copy it once (it is never shown again). Use it in the `X-API-Key` header:
  - `GET https://autodm.techaasvik.com/api/public/v1/conversations`
  - `GET https://autodm.techaasvik.com/api/public/v1/messages?conversation_id=...`
  - `GET https://autodm.techaasvik.com/api/public/v1/contacts`
  - Add `?limit=` (max 100). Revoke a key any time.
- **Outgoing webhook**: give a public https address (e.g. Zapier/Make "catch hook"). Every minute new messages are POSTed there.
  - Check `X-AutoDM-Signature` = HMAC-SHA256 of `timestamp + "." + body` using your `whsec_` secret, with `X-AutoDM-Timestamp`.
  - Failed deliveries retry automatically on the next minute.

## 5. Client billing (managers and above)
- Under **Client reports**, the **Client billing** box lets an agency bill each client workspace.
- Choose the client, period (e.g. "October 2026"), amount in ₹ and optionally paste your own payment link (e.g. a Razorpay link).
- Copy the link to the client, then press **Mark paid** when money arrives. **Cancel** voids an unpaid invoice.
- The top line shows total **Due** and **Received**; **Invoices CSV** downloads everything for your accounts.
