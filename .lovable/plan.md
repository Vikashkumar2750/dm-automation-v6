# AutoDM by Techaasvik: DM limits, branding, domain, Meta App Review

## 1. Monthly DM and automation limits by plan (the reply and DM steps stay the same)
- Each plan gets two limits:
  - **Automated DMs per month**, suggested: Free (Rs 9 trial) 300, Pro 10,000, Agency unlimited.
  - **Active automation rules**, suggested: Free 3, Pro 50, Agency unlimited. The limit counts only rules that are switched on. Users can edit a rule's keywords, posts, replies or link at any time, and the edited rule keeps working. Only creating, duplicating or switching on a rule beyond the limit is blocked. Rules the user already has stay on.
- These show up in Admin → Plans next to the price, so the super admin can change them any time.
- The super admin can also override the limits for one workspace (Admin → Organizations → workspace → a new "Plan limits override" box).
- When a workspace reaches its monthly DM limit, new automations stop and the Activity page says "Monthly DM limit reached — upgrade". A contact who has already started a flow (tapped "Send me the link" or "I followed") still gets the final link, so nobody is left halfway.
- On the Usage page, a new meter shows "DMs this month: X / Y". On the Automations page, the "New rule" button shows "Rule limit reached" once the plan's rule limit is hit.
- Only a limit check is added before a new flow starts. Instagram and Facebook follower and non-follower logic is not touched, and all existing tests must still pass.

## 2. Rename and logo
- The tool's name becomes **"AutoDM by Techaasvik"** everywhere: page titles, sidebar, login page, landing page, emails, legal pages and docs.
- The uploaded logo becomes the site icon in the browser tab and also appears in the sidebar, login page, landing page and admin panel.

## 3. Custom domain autodm.techaasvik.com
- All links will use `https://autodm.techaasvik.com`, including privacy, terms, data deletion, the Meta and Google return links, the webhook address and password-reset emails.
- The document will include a step-by-step checklist:
  - Railway: add the custom domain and update the web address setting.
  - Your domain's DNS settings: add a CNAME record.
  - Meta: App Domains, Valid OAuth Redirect URIs, webhook callback, and the Privacy, Terms and Data Deletion URLs.
  - Google: the approved return link.

## 4. New document: docs/META-APP-REVIEW-SUBMISSION.md (for submitting today)
- **Permission audit:** your screenshots show two sets of permissions:
  - **Instagram Login** set (`instagram_business_*`)
  - **Facebook Login** set (`instagram_basic`, `instagram_manage_*`, `pages_*`)
  
  I'll check the code, see which set the app really uses, and mark every permission as **Keep** or **Remove**. Early guidance:
  - **Keep:** pages_show_list, pages_manage_metadata, pages_messaging, pages_read_engagement, pages_manage_engagement and pages_read_user_content (needed for Facebook comment replies), plus the Instagram messaging, comment and publishing permissions.
  - **Probably remove:** business_management, read_insights and instagram_manage_insights, unless analytics really uses them. Asking for permissions you don't use is the most common reason reviews get rejected.
  - **Human Agent:** keep it only if you reply manually from the inbox after 24 hours.
  - **Duplicate sets:** keep only the Instagram set that the app actually uses.
- **Step-by-step removal:** exactly which Meta page to open, e.g. App Dashboard → Use cases → Customize → Permissions → Remove, and App Review → Requests → Edit submission.
- **Ready-to-paste answers for each permission:** "Describe how your app uses this", the customized developer and tech provider questions, and "How to reproduce" steps for reviewers.
- **Screencast script for each permission:** what to click, in what order, with captions. This covers login, connecting accounts, creating a rule, a real comment, the DM, the button tap and the final link.
- **Reviewer test account plan:** a test login, a test Instagram account and a test Page, including which roles to give.
- **Required API test calls:** how to make them from the Graph API Explorer.
- **Data handling answers:** data processors, data deletion, security.
- **App settings checklist:** icon, category, privacy, terms and data deletion URLs, business verification.
- **Common rejection reasons** and how to avoid each.

## Technical details
- Plan limits are stored as `limits: { monthlyDms, maxRules }` on each plan in the platform config, alongside the existing plans. The per-workspace override uses the same `feature_flags` key pattern as the safety lock, so no database change is needed.
- The monthly count uses `automation_runs` with status `sent` since the start of the month. The check goes in front of new flow starts only; taps that continue an existing flow are exempt.
- The favicon is created from logo.webp as a 64px `public/favicon.png` and linked from the root page settings; the old favicon.ico is removed. The logo goes into the app as a hosted asset.
- After the tests pass, everything is pushed to GitHub `main`.
