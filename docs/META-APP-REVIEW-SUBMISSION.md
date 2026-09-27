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
| Human Agent | **Keep** | Inbox lets a person reply manually up to 7 days |
| **read_insights** | **Remove** | Not used → common rejection reason |
| **instagram_manage_insights** | **Remove** | Not used |
| **instagram_business_manage_insights** | **Remove** | Not used |
| instagram_business_basic / _manage_messages / _manage_comments / _content_publish | **Remove from this submission** (see note) | Our login uses the Facebook-Login set above; asking for both sets for the same feature confuses reviewers |

**Note on the instagram_business_* set:** these belong to "Instagram API with Instagram login". Our Connect flow uses Facebook Login, so they are duplicates. Before removing, check **Webhooks** page → object **Instagram** is subscribed (fields `comments`, `messages`, `messaging_postbacks`). If Instagram webhooks are only configured under *Instagram → API setup with Instagram login*, also subscribe them under the main **Webhooks → Instagram** object first, test one comment, then remove the business set.

### How to remove (step by step)
1. **App Review → Requests** → open the draft submission → **Edit submission** → untick the permissions marked Remove → Save.
2. **Use cases** (left menu) → each use case → **Customize** → **Permissions and features** → next to an unused permission click **Remove**.
3. For the Instagram-login set: **Use cases → "Manage messaging & content on Instagram" (Instagram login)** → Customize → remove those permissions (or remove the use case entirely once webhooks work via the Webhooks page).
4. Reload App Review → Requests and confirm only the Keep list remains.

---

## 2. Test user for reviewers

Reviewers need to log in and see everything working.
1. Create an AutoDM login: `review@techaasvik.com` + strong password. Give it Pro plan (Admin → Plans → Give a plan, 3 months).
2. Connect a **test Facebook Page** and its linked **Instagram professional account** to that workspace.
3. Create one active rule: keyword `LINK`, public reply + DM with link `https://techaasvik.com`.
4. In Meta **App roles → Roles**, you don't need to add reviewers — they use your test login. Keep the Page/IG connected.
5. Put credentials only in the "Reviewer instructions" box (never in public docs).

---

## 3. Required API test calls

Graph API Explorer (developers.facebook.com/tools/explorer) → select app **autodm techaasvik** → Get User Access Token with all Keep permissions → run once each (this makes the "Ensure you have performed test calls" tick turn green within 24h):
- `GET me/accounts` (pages_show_list)
- `GET {page-id}?fields=name,instagram_business_account` (instagram_basic)
- `POST {page-id}/subscribed_apps?subscribed_fields=feed,messages,messaging_postbacks` (pages_manage_metadata)
- `GET {page-id}/feed?fields=id,message,comments{from,message}` (pages_read_engagement, pages_read_user_content)
- `POST {comment-id}/comments` message=Thanks (pages_manage_engagement)
- `GET {ig-user-id}/media?fields=id,caption,comments{text,username}` (instagram_manage_comments)
- `POST {page-id}/messages` recipient={comment_id}, message=Hi (pages_messaging / instagram_manage_messages)
- `POST {ig-user-id}/media` then `/media_publish` (instagram_content_publish)
- `POST {page-id}/photos` url=… (pages_manage_posts)
- `GET me/businesses` (business_management)

Or simply use the app itself with the test account — real calls count too.

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
| Human Agent | Business owners' team members reply manually from the unified inbox to customer questions that need a human, up to 7 days after the customer's last message. Automated messages never use this tag. |

**Customized developer questions (instagram_business_basic / tech provider):** answer "We are a Tech Provider; businesses connect their own accounts via Facebook Login. We do not access accounts of people who did not authorize us. Data is used only to provide the service to the connecting business and deleted on disconnect or request via /data-deletion."

**pages_messaging — "How to reproduce":**
1. Go to https://autodm.techaasvik.com/auth and log in with the test credentials.
2. Social Accounts → Facebook Page is connected.
3. Automations → rule "LINK" is active.
4. From any Facebook account, comment `LINK` on the latest post of the test Page.
5. Within seconds: a public reply appears and a Messenger message with a "Send me the link" button arrives. Tap it → the link arrives.
6. Automations → Activity shows each step. Inbox shows the conversation; type a reply to test manual messaging.

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
