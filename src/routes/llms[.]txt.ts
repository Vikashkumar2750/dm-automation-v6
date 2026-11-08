import { createFileRoute } from "@tanstack/react-router";

const BODY = `# AutoDM by Techaasvik

> AutoDM by Techaasvik is an Indian SaaS tool that automates Instagram and Facebook comment-to-DM replies, follow-gated link delivery, a unified inbox and post scheduling, plus AI public replies to YouTube comments. Official Meta APIs only.

## What it does
- Instagram and Facebook: auto public reply to comments, then a private DM with your link (comment-to-DM).
- Follow gate: followers get the link instantly; non-followers are asked to follow first.
- YouTube: smart, comment-aware public replies (YouTube has no DMs) and video publishing.
- Unified inbox, scheduling, analytics with CSV export, safety limits.
- Current pricing and plan options are listed on the homepage and workspace Billing page.

## Pages
- [Home](https://autodm.techaasvik.com/)
- [Contact](https://autodm.techaasvik.com/contact)
- [Privacy Policy](https://autodm.techaasvik.com/privacy)
- [Terms](https://autodm.techaasvik.com/terms)
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(BODY, { headers: { "content-type": "text/plain; charset=utf-8" } }),
    },
  },
});
