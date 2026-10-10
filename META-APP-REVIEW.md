# Meta App Review Guide — AutoDM by Techaasvik

Everything you need to take the Meta app from Development mode to Live:
exact permissions, app settings, the dev-mode test run, the screen recordings,
and ready answers for the review form.

Production domain used below: `https://autodm.techaasvik.com`.

---

## 1. Use cases to add in the Meta app

App dashboard → Use cases → Add use case:

| Use case | Why this app needs it |
| --- | --- |
| **Facebook Login for Business** | Business owners connect their Page + Instagram account |
| **Manage messaging and content on your Page** (Messenger) | Read and reply to Page DMs and comments |
| **Instagram messaging / Manage comments and messages on Instagram** | Read and reply to Instagram DMs and comments |
| **Instagram content publishing** | Schedule and publish photos, carousels, reels, stories |

Business verification is required before advanced access is granted:
App dashboard → Business verification → complete with your company documents
(GST/incorporation, address proof, business website, business email).

---

## 2. Permissions to request (exact list the code uses)

These are the scopes requested at login — request advanced access for each:

| Permission | Used for |
| --- | --- |
| `pages_show_list` | List the Pages a user manages so they can pick one |
| `pages_manage_metadata` | Subscribe the Page to webhooks for new messages/comments |
| `pages_read_engagement` | Read Page comments and post engagement |
| `pages_manage_engagement` | Reply to and hide comments on the Page |
| `pages_messaging` | Send and receive Page (Messenger) DMs |
| `pages_manage_posts` | Publish and schedule posts to the Page |
| `instagram_basic` | Read the connected Instagram Business account profile |
| `instagram_manage_comments` | Read, reply to and hide Instagram comments |
| `instagram_manage_messages` | Read and reply to Instagram DMs |
| `instagram_content_publish` | Publish photos, carousels, reels and stories to Instagram |
| `business_management` | Read the Business assets that own the Page/IG account |

Not requested (say so if asked): no ads permissions, no `user_*` profile data,
no data on people who did not message the business.

---

## 3. App settings checklist

**Settings → Basic**
- App name, contact email, category: Business
- Privacy Policy URL: `https://autodm.techaasvik.com/privacy`
- Terms of Service URL: `https://autodm.techaasvik.com/terms`
- Data Deletion Instructions URL: `https://autodm.techaasvik.com/data-deletion`
- App icon (1024×1024), App domains: `autodm.techaasvik.com`
- Business account: link the verified Business

**Facebook Login for Business → Settings**
- Client OAuth Login: ON, Web OAuth Login: ON
- Enforce HTTPS: ON
- Valid OAuth Redirect URIs:
  `https://autodm.techaasvik.com/api/public/oauth/meta/callback`

**Webhooks (on each use case)**
- Callback URL: `https://autodm.techaasvik.com/api/public/webhooks/meta`
- Verify token: the value in `META_WEBHOOK_VERIFY_TOKEN`
- Page fields: `messages`, `messaging_postbacks`, `feed`
- Instagram fields: `messages`, `messaging_postbacks`, `comments`, `live_comments`

`messaging_postbacks` on the **Instagram** object is required for the
comment → DM flow: taps on "Send me the link" and "I followed ✅" arrive only
through this field. Without it the commenter gets the first DM but nothing
happens when they tap.

**Important: subscribe both objects.** In Webhooks, configure the **Page**
object and the **Instagram** object. A green callback verification alone does
not mean either object is subscribed. After deploying this version, open
Social Accounts and press **Check & repair Meta**. It verifies the Page fields
(`feed`, `messages`, `messaging_postbacks`) and Instagram fields (`comments`,
`messages`, `messaging_postbacks`) separately, and reports any missing field.

**Access Token Debugger check**
- Inspect the user token created by Connect and confirm the App ID is this app.
- Confirm these granted scopes are present: `pages_show_list`,
  `pages_manage_metadata`, `pages_read_engagement`, `pages_manage_engagement`,
  `pages_messaging`, `instagram_basic`, `instagram_manage_comments`, and
  `instagram_manage_messages`.
- If any are absent, remove the app from the Facebook user's Business
  Integrations, reconnect in this platform, and grant every requested item.

**Roles → Add people**
- Add the reviewer-facing test account as **Administrator** or **Tester**
- Add one Facebook Page + one Instagram Business account you own for testing

---

## 4. Test in Development mode first (before submitting)

In Development mode only admins/developers/testers of the app can connect, so
do the full run with your own test Page and IG Business account:

1. Sign up at `/auth`, land on the dashboard.
2. Social Accounts → **Connect Instagram** and **Connect Facebook** → complete
   Facebook Login, select the Page and Instagram account, come back connected.
3. From another phone/account, send a DM to the Page and to the Instagram
   account → check they appear in **Inbox** → reply from the app → confirm the
   reply lands on Messenger/Instagram.
4. Comment on a Page post and an Instagram post → **Comments** page → public
   reply, private DM from the comment, and hide comment → confirm on Facebook/
   Instagram.
5. **Automations** → create a keyword rule (e.g. keyword "price" → DM reply)
   → send that keyword from the test account → confirm the auto-reply and the
   run log entry.
6. **Create Post** → publish one Instagram photo and one Facebook photo now,
   and schedule one for later → check the Calendar and confirm it goes live.
7. Note the login email/password of the test workspace — the reviewer needs it.

### If a new comment produces no activity

Check in this order; stop at the first failed step:

1. **Deploy the latest code.** The live Social Accounts page must show
   **Check & repair Meta** beside Refresh.
2. **Verify callback:** Meta Webhooks must show the callback as verified for
   both the Page and Instagram objects.
3. **Verify subscriptions:** press **Check & repair Meta**. It must return a
   green confirmation. A missing field usually means the login did not grant
   the matching permission; disconnect the account, remove the app from the
   Facebook user's Business Integrations, then connect again and grant all.
4. **Watch Live event feed:** add a brand-new comment from a second account.
   If no event appears, the problem is Meta delivery/subscription, before the
   automation engine. If an event appears but no automation activity appears,
   check the rule's platform, trigger, keywords, selected post and active state.
5. **Use a valid test identity:** while the app is in Development mode, the
   Facebook user who connected the business and the testing user/assets must
   be permitted by the app's roles/test setup. External customers require
   Advanced Access and Live mode.
6. **Check safety controls:** automation pause, quiet hours, cooldown, daily
   limits, contact opt-out and selected-post matching can deliberately skip a
   reply. Recent activity shows the skip reason once a webhook was received.

Expected event names in Live event feed:
- Instagram post comment: `instagram.comments`
- Facebook Page post comment: `page.feed`
- Instagram/Facebook DM: `instagram.message` or `page.message`

---

## 5. Screen recordings to upload

Record one clear video per permission group (screen recording, English or
Hindi with English subtitles, no cuts, show the URL bar). Each video:
start signed out → sign in → do the action → show the result on
Facebook/Instagram itself.

| Video | Covers | What to show |
| --- | --- | --- |
| 1. Connect | `pages_show_list`, `business_management`, `instagram_basic`, `pages_manage_metadata` | Login screen → Connect Instagram/Facebook → Facebook Login permission screen → Page + IG selection → connected account visible in Social Accounts |
| 2. Messaging | `pages_messaging`, `instagram_manage_messages` | Incoming DM appears in Inbox → type a reply → send → show the same reply inside Messenger and the Instagram app |
| 3. Comments | `pages_read_engagement`, `pages_manage_engagement`, `instagram_manage_comments` | New comment appears → public reply → private DM from comment → hide comment → show results on the post |
| 4. Automation | messaging + comments permissions | Create a keyword rule → send that keyword from a second account → auto-reply arrives → run log shows it |
| 5. Publishing | `pages_manage_posts`, `instagram_content_publish` | Create Post → upload image → select Page + IG → Publish now → show the live post on both; then schedule one and show it in the Calendar |

Upload each video on the permission's row in App Review (or one combined
video linked to every permission if the form allows it).

---

## 6. Answers for the review form

**What does your app do?**
"AutoDM by Techaasvik is a social inbox and publishing tool for
businesses. A business owner connects their own Facebook Page and Instagram
Business account, then reads and replies to their DMs and comments from one
inbox, sets keyword-based auto-replies, and schedules posts to those accounts."

**Who uses it?** "Business owners and their team members (agency staff), each
working only inside their own workspace. Only people the business invites can
see that business's messages."

**Step-by-step for the reviewer (paste into the instructions box):**
1. Go to `https://autodm.techaasvik.com/auth` and sign in with the
   test credentials supplied below.
2. Open **Social Accounts** and click **Connect Instagram** (or Facebook).
   Complete Facebook Login and select the test Page/Instagram account.
3. Open **Inbox** — messages received by that account are listed. Open one and
   send a reply; it is delivered to the person on Messenger/Instagram.
4. Open **Comments** — reply publicly, send a private reply, or hide a comment.
5. Open **Automations** — create a keyword rule; a matching incoming message
   gets the configured auto-reply.
6. Open **Create Post** — upload an image, pick the account, publish now or
   schedule for later.

**Why each permission (one line each — reuse the table in section 2).**

**How is data used and stored?**
"Messages, comments and account tokens are stored encrypted in our database,
scoped to the business that owns them, with row-level security so no other
customer can read them. Tokens are stored server-side only and never sent to
the browser. We do not sell data, do not share it with third parties, and do
not use it for advertising."

**Data deletion:** "A business can disconnect an account at any time from
Social Accounts, which deletes the stored tokens. Deleting a workspace deletes
its messages and contacts. Users can also request deletion at the
data-deletion URL and by writing to our support email."

**Do you use automated messaging?** "Yes — business-configured keyword
auto-replies to people who message the business first. We follow the 24-hour
messaging window, do not send promotional broadcasts, honour opt-out words
(STOP/UNSUBSCRIBE), enforce quiet hours and per-contact daily limits, and the
business can pause all sending instantly with a kill switch."

**Do you use the data for ads or resale?** "No."

**Test credentials to give the reviewer:** the workspace email/password you
created in section 4, plus a note that a Page and Instagram Business account
are already connected.

---

## 7. Submit and go Live

1. App Review → Permissions and Features → request **Advanced Access** for
   every permission in section 2.
2. Attach the videos, the step-by-step instructions, and test credentials.
3. Complete Business verification and the Data Use Checkup if prompted.
4. After approval, App dashboard toggle **Development → Live**.
5. Re-test one connect + one reply with an account that is *not* an app tester,
   to confirm real customers can use it.

Typical review time is a few days to two weeks. If something is rejected, Meta
names the permission and the reason — usually the video did not show the exact
in-app action, so re-record just that one and resubmit.


---

# Meta App Review — comment re-submission

## How it works

- **Facebook:** public reply, edit your Page’s own public reply, delete a selected comment, hide/unhide the latest incoming comment on an owned post.
- **Instagram:** public reply, delete, hide/unhide. Instagram’s official API does **not** support native comment editing. Delete-and-repost is not editing and must not be shown as such.
- Public replies appear beneath an existing comment. This Inbox does not create a new top-level comment on a post. Private DMs are not public comments and have no comment controls.
- Edit/delete targets a stored message in your workspace. Meta must accept the action before the Inbox changes. Only authorized team members may moderate; agents subject to approval must use a manager for these actions.
- An older app approval is not a guarantee for every new use or permission. Use the reviewed App ID and its own tokens; duplicate-app tokens are not interchangeable. Keep live domain/callbacks correct and preserve working connections.

## How to use

1. Deploy this version on your configured production domain. Verify the connected test Facebook Page/Instagram account uses the Meta app being reviewed.
2. Sign in as a workspace owner, admin or manager. From a separate permitted test account, add a fresh comment on your owned test post. Avoid automation keywords or temporarily pause the test rule.
3. Open **Inbox → Comments → Facebook**, select the test conversation. From the Comments page, **Open inbox** opens the same controls; choose Comments in Inbox.
4. Choose **Public reply**, type `Thank you — review test A`, press **Send**. Open the same Facebook post, refresh and expand replies to confirm A was posted by the Page.
5. Back in Inbox, press the pencil on that outgoing reply, change it to `Thank you — review test B`, press **Save reply**. Refresh Facebook and show B on that exact reply.
6. Press the trash icon on B → **Delete on Meta**. Refresh the same native Facebook post, expand replies and prove B is gone while the original test comment remains.
7. Optionally demonstrate **Hide comment** then **Unhide comment** on the latest incoming comment, checking visibility from the second account. Hiding is not deletion.
8. For Instagram, demonstrate public reply → native confirmation → delete → native confirmation. No pencil is shown, because Instagram editing is unsupported.

## Screencast — what to show and how

Record a continuous readable video with English captions, visible site URL, and the same test post throughout. Use desktop plus a mirrored phone or native Facebook/Instagram in another tab. Never expose passwords, tokens, secrets or payment credentials.

1. **Start:** show the production URL, sign in without exposing the password, then Social Accounts with the connected Page. Caption: `Connected Page owned by the business`.
2. **Read:** show the new comment from the second account on the post and the same comment in Inbox. Caption: `Read a comment on our own Page post`.
3. **Add:** show Public reply, text A, Send; switch to Facebook, refresh and expand replies. Caption: `Create a public reply as the Page`.
4. **Edit (Facebook):** show pencil, text B, Save reply; switch to the same Facebook post, refresh and show B. Caption: `Edit our own Page-authored comment`.
5. **Delete:** show trash and Delete on Meta confirmation; switch to Facebook, refresh and expand replies. Caption: `Delete and verify the final state in Facebook`.
6. **Finish:** keep the post with the original incoming comment present and B absent visible for several seconds.

Use a **separate Instagram clip** for the Instagram permission: reply, hide/unhide if relevant, delete, and native confirmation. Do not use Facebook editing as proof of Instagram editing. If the reviewer explicitly means **top-level** comment creation rather than a public reply, this Inbox flow does not demonstrate that; ask for clarification before submitting.

## Ready-to-paste reviewer explanation

### Facebook comment permission

> AutoDM lets an authorized business team read comments on its connected Facebook Page’s posts and moderate them. Our continuous screencast shows adding a public reply as the Page, editing that Page-authored reply, deleting it, and opening the same Facebook post to verify each change and the final deleted state. In the supplied test workspace, open Inbox → Comments → Facebook, select the demonstrated conversation, use Public reply → Send, the pencil on the outgoing reply to edit, and the trash icon → Delete on Meta to delete. We cannot edit comments written by other users.

### If Instagram’s rejection asks for editing

> We read, reply to, hide/unhide and delete comments on the connected professional account’s owned media. Instagram’s official comment API does not offer a native edit operation. Our Instagram screencast demonstrates the supported reply/deletion loop and confirms it in Instagram. Please clarify whether the edit requirement is intended for the Facebook Page comment permission. We do not represent delete-and-repost as editing.

## Re-submit checklist

- Open **only the rejected permission** in Meta App Review → request again/edit submission. Preserve already-approved permissions.
- Match the video to the platform. Facebook uses `pages_manage_engagement` with required read scopes; Instagram uses `instagram_manage_comments` for Facebook Login or `instagram_business_manage_comments` for Instagram Login. Verify actual granted scopes and connection method.
- Attach the matching video and explanation. Put reviewer login only in Meta’s private reviewer field; include test post link, Page/account name and exact steps.
- Perform the complete loop on the deployed site **before** recording. Local tests do not prove live Meta permissions or delivery. If Send/Edit/Delete fails, do not submit simulated success: check ownership, permissions, App ID and visible error.

## Official references

- [Facebook Comment reference](https://developers.facebook.com/docs/graph-api/reference/comment/)
- [Instagram comment moderation](https://developers.facebook.com/docs/instagram-platform/comment-moderation/)
- [Instagram IG Comment reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/)
