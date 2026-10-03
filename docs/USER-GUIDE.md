# AutoDM by Techaasvik — User Guide (updated after every phase)

## Everyday features
- **Social Accounts**: connect Instagram, Facebook and YouTube. "Needs reconnect" means sign in again.
- **Automations (simple mode)**: New rule → pick platform, trigger (New comment / New DM), keywords, replies. Instagram/Facebook can send a DM (with follow gate); YouTube gets public AI replies only.
- **Inbox / Comments**: read and reply manually (public reply or private DM).
- **Create Post / Calendar**: publish or schedule to many accounts; feed, reel, story, trial reel; "also publish on story".
- **AI Assistant**: captions and replies; daily limit set by Super Admin.
- **Usage & Limits / Billing**: plan, trial (3 days, then new automations pause), upgrades.

## Super Admin (System Settings)
- Global send pause, incident banner, feature flags.
- AI providers (OpenRouter keys, NVIDIA, OpenAI) with failover and spend cap.
- Site settings: GA4, GTM, AdSense, Meta Pixel, GSC/Bing verification. Blog editor under Blog.
- Email settings (Resend) with test email.

## Phase A — Story & DM entry points (off by default)
1. Super Admin → System Settings → "Story & DM entry points" → switch on (all, or listed workspace IDs) → Save.
2. Automations → New rule → trigger "Story reply" or "Story mention".
3. Social Accounts → "Ice breakers & menu" → add up to 4 questions / 5 menu items → Save → "Sync to Meta".
4. Answer ice breakers with normal "New DM" keyword rules matching the question text.

## Phase B — Visual flow builder (off by default)
1. Super Admin → System Settings → "Visual flow builder" → switch on → Save.
2. Automations → "Flow builder" button.
3. Click + → name it → pick trigger and platform.
4. Add steps: conditions (contains keyword, is follower), Send DM (optional button link), Public reply, Wait, Add tag. Drag a step by its handle to reorder (arrows also work).
5. Use "Try it" on the right to see what would happen — this box never sends.
6. Save all. A flow can be marked Active only when it has no problems listed.
7. Real sending: Super Admin → same panel → "Live sending for flows" → switch on (optionally only for listed workspace IDs) → Save.
   - Keyword rules always run first. A flow acts only if no rule replied.
   - Pause, quiet hours, hourly/daily caps, per-contact limit and opt-out words all apply.
   - After a comment, the first DM goes as a private reply; later DMs only reach the person after they reply (Meta rule).
   - Wait steps continue automatically every minute (Railway scheduler, needs CRON_SECRET).
   - Tags are saved on the contact (used later by the contacts/CRM phase).

## Phase C — AI agent for DMs (off by default)
1. Super Admin → System Settings → "AI agent for DMs" → switch on (optionally only for listed workspace IDs) → Save. It uses the AI keys set in Super Admin.
2. Automations → "AI agent" button.
3. Turn on "Agent on". Choose "Reply automatically" (off = only labels messages).
4. Set "How sure must the agent be?" (default 70%). Below this, the agent sends your handover message (optional) and marks the chat Open in the Inbox for your team.
5. Add knowledge: FAQs, prices, timings, links, policies. "From my posts" adds your published post captions. The agent answers only from this.
6. Use "Try it" to test an answer — nothing is sent. Press Save.
7. "Recent AI decisions" shows each DM: reply / handoff / analyse only / ignore, plus intent, mood, lead score and how sure it was.
- Only DMs, never comments. It replies only when no keyword rule or flow already handled the message. All safety limits apply. Intent is also saved as a tag on the contact.

## Phase D — Contacts (CRM)
**Where:** left menu → **Contacts** (below Automations). In-app "Guide" button on that page explains everything.
- Everyone who DM'd or commented on Instagram/Facebook is listed here.
- **Email / phone** are saved automatically when a person writes them in a DM (e.g. after the "Collect email / phone" flow asks). You can also edit them.
- **Tags** come from flows ("Add tag" step), the AI agent (intent), or you.
- Click a person → edit email, phone, notes, custom fields, tags → Save.
- Filters (platform, tag, has email/phone, search) → **Save segment** to reuse the group.
- **Export CSV** downloads the people currently shown.
- Test: Flow builder → "Collect email / phone" template → on → DM "details" from a test account → reply with an email → open Contacts → the person shows the email and the "lead" tag.
