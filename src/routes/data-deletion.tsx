import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, SUPPORT_EMAIL } from "@/components/app/LegalPage";

const title = "Data Deletion Instructions — AutoDM by Techaasvik";
const description =
  "How to disconnect a social account, delete a workspace, or request full deletion of your data from AutoDM by Techaasvik.";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataDeletion,
});

function DataDeletion() {
  return (
    <LegalPage title="Data Deletion Instructions" updated="21 September 2026">
      <p>
        You can remove your data from AutoDM by Techaasvik at any time. Choose the
        option that matches what you want to delete.
      </p>

      <h2>1. Disconnect a social account</h2>
      <p>
        Sign in, open <strong>Social Accounts</strong>, and choose{" "}
        <strong>Disconnect</strong> on the Instagram, Facebook or YouTube account. The
        stored access tokens for that account are deleted immediately and we stop
        receiving any new messages or comments from it.
      </p>

      <h2>2. Remove the app from Facebook or Instagram</h2>
      <p>
        On Facebook: Settings &amp; Privacy → Settings → Apps and Websites → select
        this app → Remove. On Instagram: Settings → Website permissions → Apps and
        websites → Remove. This revokes our access from the platform side as well.
      </p>

      <h2>3. Revoke our access to your YouTube channel</h2>
      <p>
        Open{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
        >
          https://myaccount.google.com/permissions
        </a>
        , select <strong>AutoDM by Techaasvik</strong> and choose{" "}
        <strong>Remove access</strong>. Google immediately revokes our YouTube access,
        and disconnecting the channel inside the app deletes its stored tokens and
        synced comments.
      </p>


      <h2>4. Delete your workspace and all its data</h2>
      <p>
        Write to {SUPPORT_EMAIL} from the email address that owns the workspace with the
        subject "Delete my workspace". We delete the workspace's messages, contacts,
        comments, posts, media files, automation rules and connected-account tokens
        within 30 days and confirm by email.
      </p>

      <h2>5. Delete your personal account</h2>
      <p>
        Write to {SUPPORT_EMAIL} with the subject "Delete my account". We remove your
        profile and workspace membership. If you are the only owner of a workspace, it
        is deleted with you unless you transfer ownership first.
      </p>

      <h2>What we keep</h2>
      <p>
        We retain billing and tax records for the period Indian law requires, and
        minimal security logs. These contain no message content.
      </p>

      <h2>Need help?</h2>
      <p>
        Email {SUPPORT_EMAIL} and we will confirm your request within a few working
        days.
      </p>
    </LegalPage>
  );
}
