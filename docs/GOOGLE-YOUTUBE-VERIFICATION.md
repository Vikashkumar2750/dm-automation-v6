# Google Cloud / YouTube API Verification — AutoDM by Techaasvik

Step-by-step guide to get the Google OAuth app verified for the two sensitive
YouTube scopes the product uses.

- **App name:** AutoDM by Techaasvik
- **Domain:** `https://autodm.techaasvik.com`
- **Scopes in use:**
  - `https://www.googleapis.com/auth/youtube.upload` (sensitive) — publish / schedule videos
  - `https://www.googleapis.com/auth/youtube.force-ssl` (sensitive) — read public comments, post public replies
  - `https://www.googleapis.com/auth/youtube.readonly` (non-sensitive) — list the creator's own videos

> Google review is completely separate from the Meta App Review. Nothing in this
> guide changes the Instagram or Facebook flows.

---

## Step 0 — What must be live before you apply

| Requirement | Where it is |
| --- | --- |
| Homepage on the verified domain | `https://autodm.techaasvik.com` |
| Privacy policy | `https://autodm.techaasvik.com/privacy` |
| Terms of service | `https://autodm.techaasvik.com/terms` |
| Data deletion page | `https://autodm.techaasvik.com/data-deletion` |
| Working Google sign-in / YouTube connect | Social Accounts page |

The privacy policy **must** explicitly mention YouTube. Add this line if it is
not already there:

> "AutoDM by Techaasvik uses YouTube API Services. By connecting your channel you
> agree to the YouTube Terms of Service (https://www.youtube.com/t/terms) and the
> Google Privacy Policy (https://policies.google.com/privacy). You can revoke our
> access at any time from https://myaccount.google.com/permissions."

---

## Step 1 — Verify the domain in Google Search Console

Google only accepts authorised domains that you own.

1. Open `https://search.google.com/search-console`.
2. **Add property → Domain** → enter `techaasvik.com`.
3. Copy the TXT record Google shows.
4. In your DNS provider add: Type `TXT`, Name `@`, Value = the string Google gave.
5. Wait a few minutes, then press **Verify**.

Use the **same Google account** here that owns the Google Cloud project.

---

## Step 2 — Configure the OAuth consent screen

Google Cloud Console → **APIs & Services → OAuth consent screen**.

1. **User type:** `External` → Create.
2. **App information**
   - App name: `AutoDM by Techaasvik`
   - User support email: your official support address
   - App logo: square PNG, at least 120×120, under 1 MB (logo review takes a few extra days)
3. **App domain**
   - Application home page: `https://autodm.techaasvik.com`
   - Privacy policy link: `https://autodm.techaasvik.com/privacy`
   - Terms of service link: `https://autodm.techaasvik.com/terms`
4. **Authorised domains:** `techaasvik.com`
5. **Developer contact information:** your admin email.
6. Save and continue.

### Authorised redirect URI

APIs & Services → **Credentials** → your OAuth 2.0 Client ID → Authorised
redirect URIs must contain exactly:

```
https://autodm.techaasvik.com/api/public/oauth/youtube/callback
```

Authorised JavaScript origin:

```
https://autodm.techaasvik.com
```

---

## Step 3 — Enable the API and declare the scopes

1. **APIs & Services → Library → YouTube Data API v3 → Enable.**
2. Back on the consent screen: **Add or remove scopes** and tick only:
   - `.../auth/youtube.readonly`
   - `.../auth/youtube.force-ssl`
   - `.../auth/youtube.upload`

Do **not** add anything else. Every extra scope adds review time and risk.

---

## Step 4 — Scope justifications (copy-paste)

### Common product description (use at the top of each answer)

> AutoDM by Techaasvik is a multi-platform social engagement tool for creators and
> small businesses. From one dashboard, a creator connects their own channels and
> manages audience engagement: scheduling posts, reading public comments in a
> unified inbox, replying publicly, and running keyword-based reply rules. All
> access is granted by the channel owner through OAuth and can be revoked at any
> time.

### `https://www.googleapis.com/auth/youtube.force-ssl`

> We use this scope so a channel owner can read the public comments on their own
> videos inside our unified inbox and publish public replies from there, plus run
> their own keyword-based reply rules. Specifically we call
> `commentThreads.list` to read top-level public comments on the authenticated
> user's own uploads and `comments.insert` to publish a public reply that the
> channel owner has configured or written. We never access private data, never
> modify video content, never post on any channel other than the authenticated
> one, and never share comment data with third parties.

### `https://www.googleapis.com/auth/youtube.upload`

> Our product includes a multi-platform content scheduler. This scope is used only
> when the channel owner explicitly uploads or schedules a video from our composer:
> we call `videos.insert` with the file, title, description and privacy status the
> user entered. No upload ever happens without a direct user action, and we do not
> modify or delete any existing video.

### `https://www.googleapis.com/auth/youtube.readonly`

> Used to list the authenticated channel's own uploads (`channels.list`,
> `playlistItems.list`) so the user can pick which of their videos a reply rule
> should apply to, and so the comment inbox can show the correct video title.

### "Why can't you use a narrower scope?"

> YouTube Data API v3 does not offer a narrower scope for publishing comment
> replies or uploading videos. `youtube.force-ssl` is the minimum scope that
> permits `comments.insert`, and `youtube.upload` is the minimum scope that
> permits `videos.insert`.

---

## Step 5 — Demo video (the most common rejection reason)

Record one screen recording, 2–4 minutes, 1080p, English narration or captions,
and upload it to YouTube as **Unlisted**. Google requires the browser URL bar to
be visible throughout.

Exact order to record:

1. Show the browser at `https://autodm.techaasvik.com` — URL bar visible.
2. Sign in to AutoDM (our own login, not a Google password).
3. Go to **Social Accounts** and click **Connect YouTube**.
4. On the Google consent screen, **pause / zoom so the OAuth client ID is readable**
   in the URL, and show the exact scopes being requested. Approve.
5. Show the connected channel appearing in the app.
6. **`youtube.upload` demo:** open the composer, pick a short video, select the
   YouTube channel, publish or schedule it, then show it on the channel.
7. **`youtube.readonly` demo:** create a reply rule and show the list of your own
   videos being used for targeting.
8. **`youtube.force-ssl` demo:** post a comment on your video from a second
   account, show it arriving in the AutoDM inbox, send a public reply from the
   inbox, and show that reply live on YouTube.
9. Show the automated reply rule producing a public reply in the activity log.
10. **Revocation:** open Settings, disconnect the channel, and show
    `https://myaccount.google.com/permissions` to prove access can be removed.

Paste the unlisted link into the verification form.

---

## Step 6 — Submit for verification

1. OAuth consent screen → **Publish app** → confirm.
2. Click **Prepare for verification** and fill in:
   - App name, home page, privacy policy, terms, authorised domains.
   - Scope justifications from Step 4.
   - Demo video link from Step 5.
   - Confirm you are the domain owner.
3. Submit.

**Timeline:** sensitive scopes typically take 3–6 weeks. Logo review and any
follow-up questions from the reviewer add time — answer their emails within a few
days or the request is closed.

---

## Step 7 — Until verification finishes

While the app is unverified:

- Up to 100 test users can use it. Add each Google account under
  **OAuth consent screen → Test users**.
- Testers see an "unverified app" warning; they can continue via
  **Advanced → Go to AutoDM (unsafe)**.
- Everything in the product keeps working for those accounts. Publishing and
  comment replies are unaffected.

---

## Step 8 — Quota notes

The default YouTube Data API quota is 10,000 units per day.

| Call | Cost |
| --- | --- |
| `commentThreads.list` | 1 unit |
| `comments.insert` | 50 units |
| `videos.insert` | 1,600 units |
| `playlistItems.list` | 1 unit |

Our polling rotates through videos and skips videos with comments disabled, so
normal use stays well inside the free quota. If you need more, apply through
**IAM & Admin → Quotas → YouTube Data API v3 → Request quota increase**, which is
a separate audit form.

---

## Common rejection reasons and fixes

| Rejection | Fix |
| --- | --- |
| "Domain not verified" | Complete Step 1 with the same Google account that owns the Cloud project. |
| "Privacy policy does not mention Google/YouTube" | Add the YouTube clause from Step 0. |
| "Demo video does not show the OAuth client ID" | Re-record showing the consent URL clearly. |
| "Scope not justified" | Paste the exact API method names from Step 4. |
| "Cannot revoke access" | Show the disconnect flow and the Google permissions page (Step 5, item 10). |
| "Requesting more scopes than needed" | Remove every scope not listed in Step 3. |
