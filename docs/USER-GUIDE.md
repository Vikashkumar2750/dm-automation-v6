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

## Phase B — Visual flow builder (off by default, test mode)
1. Super Admin → System Settings → "Visual flow builder" → switch on → Save.
2. Automations → "Flow builder" button.
3. Click + → name it → pick trigger and platform.
4. Add steps: conditions (contains keyword, is follower), Send DM (optional button link), Public reply, Wait, Add tag. Use arrows to reorder.
5. Use "Try it" on the right to see what would happen. Nothing is sent yet.
6. Save all. A flow can be marked Active only when it has no problems listed.
