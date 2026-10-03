# Contacts guide

## Where is it?
Left menu → **Contacts** (just below Automations). Everyone who sent you a DM or commented on Instagram/Facebook appears here.

## What gets saved here
- **Name / username** and platform of each person.
- **Email and phone** — saved automatically when a person writes them in a DM (for example after the "Collect email / phone" flow asks for them). You can also type them yourself.
- **Tags** — added by flows ("Add tag" step), by the AI agent (intent like "pricing"), or by you. Example: `lead`, `customer`.
- **Notes and custom fields** — anything extra, like city or order number.

## How to use
1. Open **Contacts**.
2. Use the filters (platform, tag, has email, has phone, search) to find people.
3. Click a person to open their details. Edit email, phone, notes, custom fields, add or remove tags, then **Save**.
4. **Save segment** keeps your current filters as a group you can open again with one click.
5. **Export CSV** downloads the people currently shown (for Excel/Google Sheets).

## Try it
1. Automations → Flow builder → template **"Collect email / phone"** → turn it on.
2. From a test account, DM **details**, then reply with an email.
3. Open Contacts → that person → the email is shown and the tag **lead** is added.

## Outreach (below the contacts list)
- **Abandoned-conversation nudge** — if someone stops replying mid-conversation, one gentle follow-up is sent automatically after the wait you set (default 2 hours). Only inside Meta's 24-hour window, and only once per conversation. Turn it on, set the wait and the message, then **Save nudge**.
- **Broadcast** — send one message to everyone (or only one tag) who messaged you in the last 24 hours. Meta does not allow messaging people after 24 hours of silence, so older contacts are skipped automatically.
- **Sync to Google Sheets / webhook** — paste a Zapier or Make webhook address (starts with https://). Every new email or phone captured from DMs is posted there, so a Google Sheet fills up by itself.
