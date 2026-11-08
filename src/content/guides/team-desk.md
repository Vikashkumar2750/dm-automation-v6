# Team desk guide

Team desk is for teams and agencies. Open it from **Team desk** in the left menu.

## Team members

Open **Team members** to see workspace members and roles. Owners and admins can invite teammates, copy or revoke pending invitation links, and manage eligible members. Existing **Team** links now open this tab. Member management remains available when advanced shared-inbox tools are switched off.

## 1. Shared inbox

**How it works:** all conversations of the workspace in one list. Each chat can be assigned to one teammate so two people never answer the same person.

**How to use:**
- Every conversation shows who it is **assigned to**. Pick a teammate from the dropdown to assign it.
- Filter **Mine** to see only your chats, or **Unassigned** to pick up new ones.
- Write a reply in the box and press **Send** (or **Send for approval** if you are an agent and approval is on).

## 2. Approval queue

**How it works:** when approval is on, agents cannot send DMs directly — their reply waits in the queue until a manager approves it.

**How to use:**
1. Owners, admins and managers switch on **Agents need approval**.
2. After that, agent replies go to the **Approvals** tab.
3. A manager presses **Approve & send** (the DM goes out) or **Reject** with a short note.
4. Meta's 24-hour rule still applies: approve quickly, or the reply can't be sent.

## 3. Client reports

**How it works:** one place to see activity for every workspace you belong to (your own + client workspaces), so you can report to clients or bill them.

**How to use:**
1. Pick the period: last 7/30/90 days. You see messages in, replies out, automation runs, active chats, plan and plan expiry.
2. **Download CSV** to share a report with a client or to bill them.

## 4. API & webhooks (managers and above)

**How it works:** the API key lets an external tool read your conversations, messages and contacts (read-only). The outgoing webhook pushes every new message to your own address (e.g. Zapier) every minute, signed so you can verify it came from here.

**How to use:**
1. **API key**: create one, copy it once (it is never shown again). Use it in the `X-API-Key` header:
   - `GET https://autodm.techaasvik.com/api/public/v1/conversations`
   - `GET https://autodm.techaasvik.com/api/public/v1/messages?conversation_id=...`
   - `GET https://autodm.techaasvik.com/api/public/v1/contacts`
   - Add `?limit=` (max 100). Revoke a key any time.
2. **Outgoing webhook**: give a public https address (e.g. Zapier/Make "catch hook"). Every minute new messages are POSTed there.
   - Check `X-AutoDM-Signature` = HMAC-SHA256 of `timestamp + "." + body` using your `whsec_` secret, with `X-AutoDM-Timestamp`.
   - Failed deliveries retry automatically on the next minute.

## 5. Client billing (managers and above)

**How it works:** you create an invoice for a client workspace, send the payment link yourself, and mark it paid when the money arrives. Nothing is charged automatically.

**How to use:**
1. Under **Client reports**, open the **Client billing** box and choose the client, period (e.g. "October 2026") and amount in ₹; optionally paste your own payment link (e.g. a Razorpay link).
2. Copy the link to the client, then press **Mark paid** when money arrives. **Cancel** voids an unpaid invoice.
3. The top line shows total **Due** and **Received**; **Invoices CSV** downloads everything for your accounts.
