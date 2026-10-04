# Trust & safety guide

Open **Trust & safety** in the left menu (below Account Health). It keeps your Instagram/Facebook accounts safe.

## 1. Account health score

### How it works
- Every connected account gets a score from **0 to 100**: green (80+) is good, yellow (50–79) needs a look, red (below 50) is at risk.
- Points are lost for: account not connected, access expiring or expired, many failed messages this week, Meta slowing you down, incoming events failing, or no events for 7+ days.
- Each reason is written in plain words so you know what to fix.

### How to use
1. Open **Trust & safety → Health score**.
2. Look at each account card: the big number is the score, the badge tells you if it is Healthy, Needs a look or At risk.
3. Read the bullet list under the score — each line is one thing to fix (for example "Access expires in 3 days").
4. Fix what the list says (reconnect the account, renew access, slow down sending), then come back and check the score again. The page refreshes itself every minute.

## 2. Predictive rate-limit guard

### How it works
- Shows how fast you are sending right now and the forecast for the hour, compared with your hourly limit.
- **Yellow (watch)**: you are close to your limit or Meta rejected a message for speed.
- **Red (slow down)**: Meta rejected 3+ messages for speed in 15 minutes. With **Auto slow-down** on, sending pauses for **15 minutes**, then restarts by itself. This protects the account from a Meta block.
- Owners, admins and managers can switch Auto slow-down off (not recommended).

### How to use
1. Open **Trust & safety → Rate-limit guard**.
2. Check the badge next to **Sending pace**: Safe, Watch or Slow down. The line below shows messages sent last hour, the forecast for this hour, and your hourly/daily limits.
3. Keep **Auto slow-down** switched on (it is on from the start). You only need to act when the badge is yellow or red: wait for the pause to finish, or reduce how many automations send at once.
4. If sending was paused, the page shows **Paused until** with the time and reason — no action is needed, sending restarts by itself.

## 3. Compliance centre & policy checker

### How it works
- Every automation's messages are checked for common Meta policy problems.
- **Blocked** (cannot be saved): asking for passwords/OTP/card details, guaranteed money claims, restricted content (betting, adult, buying followers).
- **Warnings** (can be saved, but fix if you can): short links (bit.ly etc.), "like/share/tag to win", mostly CAPITALS, more than 3 links, messages over 1000 characters.
- The check also runs when you press **Save** on an automation.

### How to use
1. Open **Trust & safety → Compliance** to see the report for all your automations at once.
2. Automations marked **Breaks policy** (red) must be fixed — open **Automations**, edit that rule and remove the blocked text. Blocked text cannot be saved at all.
3. Automations marked **Warning** (yellow) can still run, but fixing them lowers the chance of Meta trouble — for example replace short links with full https links.
4. When writing a new automation, the same check runs on **Save**: if it is blocked you will see the reason and the save is stopped; if there is a warning you can still save, but try to fix it.

## 4. Audit trail

### How it works
- Owners, admins and managers see a list of every change in the workspace: who did it, when, what (automation, safety settings, team member, API key, webhook, payment keys, invoices…) and which fields changed.
- Secret values (keys, tokens) are never stored in the audit trail — only that they changed.
- Changes made automatically by the system are shown as "System".

### How to use
1. Open **Trust & safety → Audit trail** (visible to owners, admins and managers only).
2. Use the filter dropdown (for example only "Automation" changes) to find what you are looking for.
3. Each row shows: when it happened, who did it, what was created/changed/deleted, and which fields changed.
4. Press **Download CSV** to keep a record for your team or for a Meta/security review.
