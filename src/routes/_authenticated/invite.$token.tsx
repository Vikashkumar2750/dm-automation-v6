import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { acceptInvite, getInvite } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/invite/$token")({
  head: () => ({
    meta: [
      { title: "Workspace invitation — AutoDM by Techaasvik" },
      { name: "description", content: "Join a workspace you were invited to." },
      { property: "og:title", content: "Workspace invitation — AutoDM by Techaasvik" },
      { property: "og:description", content: "Join a workspace you were invited to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

const messages: Record<string, string> = {
  not_found: "This invite link is not valid.",
  expired: "This invite link has expired. Ask for a new one.",
  already_accepted: "This invite was already used.",
  wrong_account: "This invite was sent to a different email address.",
  email_unverified: "Please verify your email address first, then open this invite again.",
};

function InvitePage() {
  const { token } = useParams({ from: "/_authenticated/invite/$token" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchInvite = useServerFn(getInvite);
  const accept = useServerFn(acceptInvite);

  const invite = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite({ data: { token } }),
  });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { token } }),
    onSuccess: (result) => {
      if ("error" in result && result.error) {
        toast.error(messages[result.error] ?? "Could not join this workspace.");
        return;
      }
      if ("organizationId" in result && result.organizationId) {
        window.localStorage.setItem("dmfiy.active_org", result.organizationId);
      }
      queryClient.invalidateQueries();
      toast.success("You joined the workspace.");
      void navigate({ to: "/dashboard" });
    },
    onError: () => toast.error("Could not join this workspace."),
  });

  const data = invite.data;
  const error = data && "error" in data ? data.error : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Workspace invitation" />
      <Panel>
        {invite.isLoading && <p className="text-sm text-muted-foreground">Loading invite…</p>}

        {error && (
          <EmptyState
            icon={MailCheck}
            title="Invite unavailable"
            description={messages[error] ?? "This invite can no longer be used."}
          />
        )}

        {data && "invite" in data && (
          <div>
            <p className="text-sm text-muted-foreground">You've been invited to join</p>
            <h2 className="mt-1 text-xl font-semibold">{data.invite.organizationName}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Role: <span className="font-medium">{data.invite.role}</span> · Invite sent to{" "}
              {data.invite.email}
            </p>
            {!data.invite.matchesAccount && (
              <p className="mt-3 text-sm text-warning">
                You are signed in with a different email. Sign in as {data.invite.email} to
                accept.
              </p>
            )}
            <Button
              className="mt-5"
              disabled={!data.invite.matchesAccount || acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
            >
              Join workspace
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
