import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [
    { title: "Team members — AutoDM Team Desk" },
    { name: "description", content: "Manage workspace members and invitations in AutoDM Team Desk." },
    { property: "og:title", content: "Team members — AutoDM Team Desk" },
    { property: "og:description", content: "Manage workspace members and invitations in AutoDM Team Desk." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/team-desk", search: { tab: "members" }, replace: true }); },
});