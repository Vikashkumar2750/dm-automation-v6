# AutoDM by Techaasvik — Meta App Review submission guide

Meta app name: **autodm techaasvik** · Tool name: **AutoDM by Techaasvik** · Domain: **https://autodm.techaasvik.com**

---

## 0. Before you submit (do in this order)

### 0.1 Custom domain live
1. **Railway** → project → service → **Settings → Networking → Custom Domain** → add `autodm.techaasvik.com`. Railway shows a CNAME target.
2. **DNS (techaasvik.com registrar)** → add `CNAME  autodm  →  <railway target>`. Wait until Railway shows a green tick (SSL issued).
3. **Railway → Variables** → set `PUBLIC_APP_URL=https://autodm.techaasvik.com` → ✓ → redeploy. (All links — OAuth return, click tracking, password reset — are built from the domain the request comes on, so nothing else in code changes.)
4. Open https://autodm.techaasvik.com/privacy, /terms, /data-deletion — all must load without login.

### 0.2 Meta app settings (developers.facebook.com → your app)
| Page | Field | Value |
|---|---|---|
| App settings → Basic | App domains | `autodm.techaasvik.com` |
| App settings → Basic | Privacy Policy URL | `https://autodm.techaasvik.com/privacy` |
| App settings → Basic | Terms of Service URL | `https://autodm.techaasvik.com/terms` |
| App settings → Basic | User data deletion → Instructions URL | `https://autodm.techaasvik.com/data-deletion` |
| App settings → Basic | App icon | AutoDM logo, 1024×1024 |
| App settings → Basic | Category | Business and Pages |
| App settings → Basic | Contact email | your support email |
| Facebook Login for Business → Settings | Valid OAuth Redirect URIs | `https://autodm.techaasvik.com/api/public/oauth/meta/callback` |
| Webhooks (Page + Instagram objects) | Callback URL | `https://autodm.techaasvik.com/api/public/webhooks/meta` (same verify token as Railway `META_WEBHOOK_VERIFY_TOKEN`) |
| Instagram → API setup with Instagram login → Webhooks | Callback URL | same as above |

Keep the old Railway URLs in the redirect list too until the new domain is verified working, then remove them.

### 0.3 Google (YouTube)
Google Cloud Console → APIs & Services → Credentials → your OAuth client → **Authorized redirect URIs** → add `https://autodm.techaasvik.com/api/public/oauth/google/callback`. Also update the OAuth consent screen home page, privacy and terms links.

### 0.4 Business verification
Meta Business Suite → **Business settings → Security Centre → Start verification**. Advanced access is not granted without it (you are already a Tech Provider, so this is likely done — confirm the green tick).

### 0.5 Railway secret
Set `INSTAGRAM_APP_SECRET` (Instagram app ID `1497788405165320` → Meta → Instagram → API setup with Instagram login → **Instagram app secret** → Show → copy). Never paste it in chat.

---

## 0.6 New features (Phases A–I, P2) — kya koi NAYI permission chahiye? (checked in code, Oct 2026)

**Short answer: koi bhi nayi permission add NAHI karni.** Saare naye features pehle se maangi gayi permissions se hi chalte hain. Connect button ki scope list (`src/lib/social.ts → metaScopes`) change nahi hui hai — wahi 12 permissions hain jo section 1 mein hain.

| Naya feature | Meta API jo use hota hai | Permission (already requested) | Review form mein kya jodna hai |
|---|---|---|---|
| Story reply / Story mention trigger (Phase A) | `messages` webhook (story attachment) + Send API | `instagram_manage_messages`, `instagram_business_manage_messages` | Is permission ke "How do you use" answer mein ek line: *"When a user replies to or mentions the business in a Story, we send one DM reply configured by the business."* Screencast mein 1 story reply dikhao |
| Ice breakers (IG + FB) | `POST /me/messenger_profile` (`ice_breakers`) | IG: `instagram_manage_messages` · FB: `pages_messaging` | Answer mein jodo: *"The business sets ice-breaker questions shown when a user opens a new chat."* |
| Messenger persistent menu (FB only) | `POST /me/messenger_profile` (`persistent_menu`) | `pages_messaging` | Same answer mein `persistent menu` likho |
| Button taps (flows, ice breakers, menu) | `messaging_postbacks` webhook | `pages_messaging` / `instagram_manage_messages` | Webhook field `messaging_postbacks` subscribed rehna chahiye (pehle se hai) |
| Flow builder live sending, Wait steps (Phase B) | Send API (24h window ke andar) | `pages_messaging`, `instagram_manage_messages` | Kuch nahi — same DM sending |
| AI agent DM replies (Phase C) | Send API, sirf user ke message ke baad | same | Answer mein: *"Optional AI reply is sent only in response to a user's message, inside the 24-hour window, and never overrides a human."* |
| Contacts / CRM, email-phone capture (Phase D) | Koi naya Meta call nahi (data hamare DB mein) | — | Data handling answer mein "email/phone only when the user types it in DM" likho |
| Payment link / coupon DMs (Phase E) | Send API | same | Kuch nahi |
| Broadcasts + abandoned nudges | Send API, **sirf last 24h mein active contacts** ko | same | Answer mein: *"No messages are sent outside the 24-hour standard messaging window; no message tags are used."* |
| Team desk / Human takeover (Phase G, P2) | Inbox se manual reply (Send API) | same | — |
| Trust & safety, Growth insights (H, I) | Koi Meta call nahi (hamare DB se) | — | `read_insights` / `instagram_manage_insights` ab bhi **mat maango** |

**Human Agent permission — update:** code abhi `HUMAN_AGENT` message tag **use nahi karta** (manual reply bhi 24h window ke andar normal message hai). Isliye:
- Agar abhi submit kar rahe ho → **Human Agent ko remove kar do** (unused permission = rejection risk).
- Baad mein 24h ke baad manual reply chahiye to pehle code mein tag jodna padega, phir alag se request karna.

**Webhook fields (check karo, naya kuch nahi):** Page → `feed`, `messages`, `messaging_postbacks`; Instagram → `comments`, `messages`, `messaging_postbacks`. Story mentions `messages` field se hi aate hain.

---


## 1. Permission audit — what to keep, what to remove

What the app's Connect button actually asks for (from the code): `pages_show_list, pages_manage_metadata, pages_read_engagement, pages_read_user_content, pages_manage_engagement, pages_messaging, pages_manage_posts, instagram_basic, instagram_manage_comments, instagram_manage_messages, instagram_content_publish, business_management`.

The app **never** calls insights APIs.

| Permission | Decision | Why |
|---|---|---|
| public_profile | Keep (automatic) | Login |
| pages_show_list | **Keep** | List Pages to connect |
| pages_manage_metadata | **Keep** | Subscribe Page to webhooks |
| pages_read_engagement | **Keep** | Read Page posts + commenter name |
| pages_read_user_content | **Keep** | Read user comments on Page posts |
| pages_manage_engagement | **Keep** | Post the public reply to a Facebook comment |
| pages_messaging | **Keep** | Send the Messenger DM / private reply |
| pages_manage_posts | **Keep** | "Publish now" / scheduled Facebook posts |
| instagram_basic | **Keep** | Read IG account + media for post picker |
| instagram_manage_comments | **Keep** | Read + reply to IG comments |
| instagram_manage_messages | **Keep** | IG DMs, private replies, follow check |
| instagram_content_publish | **Keep** | IG publishing |
| business_management | **Keep** (requested by our login) | Needed for Pages owned by a Business portfolio. If you remove it, tell me and I'll remove it from the login too — otherwise reviewers see a mismatch |
| Human Agent | **Remove while unused** | Manual replies currently use the standard 24-hour window, not HUMAN_AGENT |
| **read_insights** | **Remove** | Not used → common rejection reason |
| **instagram_manage_insights** | **Remove** | Not used (46 calls shown came from Graph Explorer tests, not the app) |
| **instagram_business_manage_insights** | **Remove** | Not used (0 calls) |
| instagram_business_basic | **Keep** (updated) | 76 real API calls — Instagram-login token path + webhooks use it |
| instagram_business_manage_messages | **Keep** (updated) | 73 real API calls — IG DMs / button taps via Instagram-login webhook |
| instagram_business_manage_comments | **Keep** (updated) | IG comment webhooks (`comments`) come through the Instagram-login product |
| instagram_business_content_publish | Optional — remove | 0 calls; publishing uses `instagram_content_publish`. Remove only if you won't show it in the video |
| email, ads_*, catalog_*, branded_content_*, marketplace_*, shopping, upcoming_events, Public Content Access, Business Asset User Profile | **Do not add** | Not used — leave them on "Add to App Review" (not requested) |

**Update (based on your Webhooks screenshots):** Instagram comment/DM events currently arrive through **Instagram API → API setup with Instagram login → Webhooks** (comments, messages, messaging_postbacks … all subscribed). That product needs the `instagram_business_*` permissions. **Do not remove** `instagram_business_basic`, `_manage_messages`, `_manage_comments` — removing them can stop the working Instagram automation. Requesting both sets is fine because each has real API calls and a real use.

### How to remove (step by step)
1. **Use cases → Instagram API → Customize → Permissions and features** → row **read_insights** → **Actions ▾ → Remove**. Repeat for **instagram_manage_insights** and **instagram_business_manage_insights**. (Optional: instagram_business_content_publish.)
2. **App Review → Requests** → open draft → **Edit submission** → confirm those rows are gone → Save.
3. Do the same check in the other use cases (Messenger / Facebook Login for Business) — a permission "Found in 3 use cases" must be removed in each, or it will still be requested.
4. Test once after removal: one Instagram comment + one Facebook comment → full flow must still work.

### 1.1 Webhooks — what to keep (Use cases → Customize → Webhooks)
| Object | What to do |
|---|---|
| **Page** | Must stay subscribed: `feed`, `messages`, `messaging_postbacks`, `message_echoes`, `messaging_optins`, `standby`, `mention`. Everything else (affiliation, attire, awards, birthday, hours, leadgen, calls, marketing_message_*, invoice…, etc.) is **not used** — safe to Unsubscribe to reduce noise. Leave `message_context` unsubscribed. Optional, not required for review |
| **Instagram (Instagram-login product)** | Already correct — keep `comments`, `messages`, `messaging_postbacks`, `live_comments`, `mentions`, `standby`, `messaging_seen`, `message_reactions`. **Don't change** |
| **Permissions** | Not used by the app. Leave as is (it only notifies when a user revokes a permission). No action |
| **Application** | Not used. Leave as is |
| **WhatsApp Business Account** | Empty — leave empty (WhatsApp is your separate tool) |

Callback URL on Page + Instagram objects: `https://autodm.techaasvik.com/api/public/webhooks/meta` (after the domain is live). Change it on both objects at the same time, with the same verify token.

### 1.2 Facebook Login for Business → Configurations (fix needed — from your screenshots)

Your **"Instagram onboarding"** configuration (ID `870669472036175`) shows a red warning: **"Some permissions have been restricted and won't be requested from users of this app."** This appeared because you removed the 3 insights permissions — the configuration still lists them. It also does **not** match what the app's Connect button asks for.

**Fix (2 minutes):**
1. **Facebook Login for Business → Configurations → Instagram onboarding → Edit → Permissions** (the page in your screenshots).
2. **Remove** any of these if still listed: `read_insights`, `instagram_manage_insights`, `instagram_business_manage_insights` — this clears the red warning.
3. **Tick these boxes** (currently unticked in your screenshots, but the app's login asks for them — a mismatch here means new connections won't get comment-reply and publishing rights):
   - `business_management`
   - `pages_manage_engagement`
   - `pages_manage_posts`
   - `pages_read_user_content`
4. Keep ticked: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_manage_metadata`, `pages_messaging`, `pages_read_engagement`, `pages_show_list` (+ `instagram_business_*` ones if listed).
5. **Save.** The red warning must disappear. Final list = exactly the 12 permissions the app requests (section 1) + the `instagram_business_*` set.
6. After saving, reconnect one test account once (Social Accounts → disconnect → connect) so its token gets the full permission set, and confirm automation still works.

### 1.3 Final to-do order (today)
1. Domain live on Railway + `PUBLIC_APP_URL` (section 0.1).
2. `INSTAGRAM_APP_SECRET` set in Railway (section 0.5).
3. Update Callback URL on Page + Instagram webhook objects, App domains, OAuth redirect, Privacy/Terms/Deletion URLs (0.2).
4. Remove the 3 insights permissions (section 1 steps).
5. Test IG follower, IG non-follower, FB comment once each.
6. Run test API calls (section 3), wait for green ticks.
7. Record screencast (section 5), fill answers (section 4), reviewer login (section 2) → **Submit**.

---

## 2. Test user for reviewers

Reviewers need to log in and see everything working.
1. Create an AutoDM login: `review@techaasvik.com` + strong password. Give it Pro plan (Admin → Plans → Give a plan, 3 months).
2. Connect a **test Facebook Page** and its linked **Instagram professional account** to that workspace.
3. Create one active rule: keyword `LINK`, public reply + DM with link `https://techaasvik.com`.
4. In Meta **App roles → Roles**, you don't need to add reviewers — they use your test login. Keep the Page/IG connected.
5. Put credentials only in the "Reviewer instructions" box (never in public docs).

---

## 3. Required API test calls — step by step ( easiest way)

The "Ensure you have performed test API calls" warning turns green automatically once Meta sees real API calls from your app in the last 30 days. **You have two options:**

### Option A (recommended, zero extra work): just use the app
You already tested automation on both platforms after removing the permissions — those were real API calls. Do this once more with the **reviewer test account** (section 2) so every permission gets a fresh call:
1. Log in as the reviewer account → Social Accounts → disconnect + reconnect Facebook & Instagram (covers `pages_show_list`, `business_management`, `pages_manage_metadata`, `instagram_basic`).
2. Comment the keyword on one FB post and one IG post → full flow (covers `pages_read_engagement`, `pages_read_user_content`, `pages_manage_engagement`, `pages_messaging`, `instagram_manage_comments`, `instagram_manage_messages`).
3. Create Post → publish one photo to FB + one to IG (covers `pages_manage_posts`, `instagram_content_publish`).
4. Check **App Review → each permission row** within 24–48 hours — the test-call warning clears on its own.

### Option B (if a specific permission row still shows the warning): Graph API Explorer
1. Open **developers.facebook.com/tools/explorer**.
2. Top-right dropdown: select app **autodm techaasvik**.
3. Click **Generate Access Token** → log in with YOUR Facebook account (the app admin) → tick all permissions when asked.
4. In the query box, run these one by one (replace `{page-id}` / `{ig-user-id}` / `{comment-id}` with your test Page/IG values — `{page-id}` and `{ig-user-id}` are visible in AutoDM → Social Accounts; `{comment-id}` from any recent comment):

| Call | Covers |
|---|---|
| `GET me/accounts` | pages_show_list |
| `GET {page-id}?fields=name,instagram_business_account` | instagram_basic |
| `GET {page-id}/feed?fields=id,message,comments{from,message}` | pages_read_engagement, pages_read_user_content |
| `POST {comment-id}/comments` with field `message=Thanks!` | pages_manage_engagement |
| `GET {ig-user-id}/media?fields=id,caption,comments{text,username}` | instagram_manage_comments |
| `GET me/businesses` | business_management |

For `pages_messaging`, `instagram_manage_messages`, `pages_manage_posts`, `instagram_content_publish` — use the app itself (Option A steps 2–3); it's easier than hand-building POST calls, and real calls count the same.

5. If a call returns an error, the permission name in the error tells you which one is missing from the token — regenerate the token with it ticked.

---

## 4. Ready-to-paste answers

Common intro (use at the start of each answer):
> AutoDM by Techaasvik (https://autodm.techaasvik.com) is a SaaS tool for businesses and creators to manage their own Facebook Pages and Instagram professional accounts. The business owner connects their own accounts, creates keyword rules, and the tool replies to comments and sends the requested link by DM only after the user interacts. The business owner can also read and reply to messages manually in a unified inbox and publish posts.

| Permission | "Describe how your app uses this" |
|---|---|
| pages_show_list | After Facebook Login, we list the Pages the user manages so they can choose which Page to connect to AutoDM. |
| pages_manage_metadata | We subscribe the connected Page to webhooks (feed, messages, messaging_postbacks) so we receive new comments and messages in real time to run the owner's automation rules. |
| pages_read_engagement | We read the Page's posts so the owner can choose which posts a rule applies to, and read the commenter's name to show it in the inbox and activity log. |
| pages_read_user_content | We read comments users leave on the Page's posts to check them against the owner's keyword rules. |
| pages_manage_engagement | When a comment matches a rule, we post a public reply to that comment on behalf of the Page (e.g. "Sent you a DM!"). |
| pages_messaging | We send one private reply to the commenter with a button; the link is sent only after the person taps the button. The owner can also reply manually from the inbox. We never send promotional messages outside the 24-hour window. |
| instagram_basic | We read the connected Instagram professional account's profile (name, username, picture) and its media so the owner can pick posts for rules. |
| instagram_manage_comments | We read comments on the owner's Instagram posts to match keywords and post a public reply to the matched comment. |
| instagram_manage_messages | We send a private reply to the commenter, handle their button taps, check whether they follow the business (if the owner requires it), then deliver the requested link. The owner also reads and answers DMs in the inbox. |
| instagram_content_publish | The owner creates a photo/video/reel in AutoDM and publishes it now or schedules it to their Instagram account. |
| pages_manage_posts | The owner publishes or schedules posts to their Facebook Page from AutoDM. |
| business_management | Required to access Pages and Instagram accounts that are owned by the user's Business portfolio when connecting. |
| Human Agent | Not currently used: manual replies follow the standard 24-hour window. Do not claim 7-day tagged delivery. |

**Customized developer questions (instagram_business_basic / tech provider):** answer "We are a Tech Provider; businesses connect their own accounts via Facebook Login. We do not access accounts of people who did not authorize us. Data is used only to provide the service to the connecting business and deleted on disconnect or request via /data-deletion."

**pages_messaging — "How to reproduce":**
1. Go to https://autodm.techaasvik.com/auth and log in with the test credentials.
2. Social Accounts → Facebook Page is connected.
3. Automations → rule "LINK" is active.
4. From any Facebook account, comment `LINK` on the latest post of the test Page.
5. Within seconds: a public reply appears and a Messenger message with a "Send me the link" button arrives. Tap it → the link arrives.
6. Automations → Activity shows each step. Inbox shows the conversation; type a reply to test manual messaging.

---

## 4.1 Copy-paste block — App Review form questions

### "Allowed usage" / "How does your app use this permission?" (per permission)
Use the table in section 4 above — one row per permission, paste as-is.

### "Tell us how your app works" / App description
```
AutoDM by Techaasvik (https://autodm.techaasvik.com) is a SaaS tool for businesses and creators to manage their own Facebook Pages and Instagram professional accounts. The business owner connects their own accounts via Facebook Login, creates keyword-based automation rules, and the tool posts a public reply to matching comments and sends the requested link by DM only after the user interacts (taps a button). The owner can also read and reply to messages manually in a unified inbox, and publish or schedule posts to their connected accounts. We never message anyone who has not interacted with the business first, we respect the 24-hour messaging window, and every automated message is configured by the business owner themselves.
```

### Reviewer instructions (paste in the instructions box; add your real test login)
```
Test login: review@techaasvik.com / <password>  (Pro plan, test Page + Instagram already connected)

1. Go to https://autodm.techaasvik.com/auth and log in with the credentials above.
2. Open Social Accounts — a Facebook Page and its linked Instagram professional account are already connected. (To see the connection flow, click Connect and complete Facebook Login with your own account.)
3. Open Automations — an active rule with keyword "LINK" is configured (public reply + DM with link).
4. From any Facebook/Instagram account, comment "LINK" on the latest post of the connected Page/IG account.
5. Within seconds you will see: a public reply under the comment, and a DM with a "Send me the link" button. Tap the button — the final link arrives by DM. (On Instagram, if the commenting account does not follow the business, a "Visit profile / I followed" step appears first.)
6. Open Automations → Activity to see every step logged. Open Inbox to see the conversation and send a manual reply.
7. Open Create Post to publish or schedule a post to the connected accounts.
A screencast of this exact flow is attached to each permission.
```

### Data handling questions
```
Where is data stored? On our servers hosted on Railway, with our managed database. Access tokens are stored encrypted server-side and never sent to the browser.
Who do you share data with? No one. We do not sell data, do not share it with third parties, do not use it for advertising, and do not use it to train AI models. Payment processing (Razorpay) receives only payment details, never Meta data.
How long is data kept? Until the business disconnects the account (tokens deleted immediately) or requests deletion via https://autodm.techaasvik.com/data-deletion or email — completed within 30 days.
How is data secured? HTTPS everywhere, webhook signature verification (HMAC-SHA256), row-level security so one business can never read another's data, role-based access, and rate limits.
```

### "Do you use automated messaging?"
```
Yes — business-configured keyword auto-replies sent only to people who comment on or message the business first. We follow the 24-hour messaging window, send at most one automated DM per comment, deliver the link only after the person taps a button, honour opt-out words (STOP/UNSUBSCRIBE), enforce per-contact daily limits and quiet hours, and the business can pause all automation instantly. We never send promotional broadcasts.
```

### Business verification / "What is your business relationship with users?"
```
We are a SaaS provider (Tech Provider). Our customers are businesses and creators who connect their own Facebook Pages and Instagram professional accounts to manage their own customer conversations. We only access accounts that the business owner explicitly connects and authorizes through Facebook Login. We never access data of people who have not interacted with the business.

---

## 5. Screencast script (one video can cover all; 2–4 min, 1080p, English captions)

1. Show the browser URL `autodm.techaasvik.com`, log in.
2. Social Accounts → click **Connect Facebook & Instagram** → Facebook Login dialog shows **all permissions** → select Page + IG → Continue. *(Caption: "Business owner connects their own Page and Instagram")*
3. Show the connected accounts.
4. Automations → create rule: keyword, choose post (post picker = pages_read_engagement/instagram_basic), public reply text, DM + link → Save.
5. Switch to phone/another browser: comment the keyword on Instagram post → show public reply → show DM with button → tap → (non-follower: Visit profile / I followed) → link arrives.
6. Repeat quickly on the Facebook Page.
7. Back in AutoDM: Activity log shows the steps; Inbox shows the conversation; send a manual reply (Human Agent / messaging).
8. Create Post → upload image → select IG + FB → **Publish now** → show the post live on both.
9. Settings → disconnect account and show /data-deletion page.

Record separate short clips if Meta rejects "one video for all" — the same script, cut per permission.

---

## 6. Data handling answers
- **Data processors:** Railway (hosting), our managed database (Lovable Cloud), Razorpay (payments only; no Meta data).
- **Stored:** Page/IG IDs, names, access tokens (encrypted, never shown in the browser), comments/messages needed for the inbox and activity log.
- **Not done:** no selling, no ads targeting, no sharing with third parties, no data used to train AI.
- **Deletion:** disconnect in Social Accounts deletes tokens; full deletion via /data-deletion or email, within 30 days.
- **Security:** HTTPS, webhook signature checks (HMAC), role-based access, rate limits.
- **Countries of processing:** as per Railway region.

---

## 7. Common rejection reasons and how to avoid
| Reason | Avoid by |
|---|---|
| Permission requested but not shown in video | Every Keep permission appears in the screencast |
| Unused permissions | Remove insights and duplicate business set |
| Reviewer cannot log in | Test login works, Page stays connected, plan active |
| Privacy policy doesn't mention Meta data | Our /privacy covers it — check it loads |
| Messages look like spam / outside 24h | Explain: one reply per comment, link only after tap |
| App not in Live mode after approval | After approval: App dashboard → switch **App mode: Live** |

---

## 8. After approval
1. Switch app to **Live**.
2. Test with a normal (non-tester) account on both platforms.
3. Remove old Railway URLs from Meta redirect list.


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
