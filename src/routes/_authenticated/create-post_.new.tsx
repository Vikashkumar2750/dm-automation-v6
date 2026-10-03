import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel } from "@/components/app/primitives";
import { PostComposerForm } from "@/components/app/PostComposer";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { listSocialAccounts } from "@/lib/social-accounts.functions";

export const Route = createFileRoute("/_authenticated/create-post_/new")({
  head: () => ({
    meta: [
      { title: "New Post — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Compose once, schedule and publish to Instagram, Facebook and YouTube.",
      },
      { property: "og:title", content: "New Post — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content: "Compose once, schedule and publish to Instagram, Facebook and YouTube.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewPostPage,
});

function NewPostPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? "";

  const fetchAccounts = useServerFn(listSocialAccounts);
  const navigate = useNavigate({ from: Route.fullPath });

  const accountsQuery = useQuery({
    queryKey: ["social-accounts", orgId],
    queryFn: () => fetchAccounts({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
  });

  return (
    <AppShell>
      <PageHeader
        title="New post"
        description="Compose once, schedule it, and let the queue publish for you."
        actions={
          <Button variant="outline" asChild>
            <Link to="/create-post">
              <ArrowLeft className="mr-2 size-4" /> Back to posts
            </Link>
          </Button>
        }
      />

      {orgId ? (
        <Panel title="Compose">
          <PostComposerForm
            organizationId={orgId}
            accounts={accountsQuery.data ?? []}
            draft={null}
            onDone={() => navigate({ to: "/create-post" })}
          />
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Open a workspace to create posts.
          </p>
        </Panel>
      )}
    </AppShell>
  );
}
