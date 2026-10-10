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
