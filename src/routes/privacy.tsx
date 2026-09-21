import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, SUPPORT_EMAIL } from "@/components/app/LegalPage";

const title = "Privacy Policy — DM FB-IG-YT by Techaasvik";
const description =
  "How DM FB-IG-YT by Techaasvik collects, uses, stores and deletes Instagram, Facebook and YouTube data connected by business owners.";

export const Route = createFileRoute("/privacy")({
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
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="21 September 2026">
      <p>
        DM FB-IG-YT by Techaasvik ("the Service") helps a business manage its own
        Instagram, Facebook and YouTube conversations and posts. This policy explains
        what we collect, why, and how you can delete it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your name, email address and profile
          picture, used to sign you in and show who is in your workspace.
        </li>
        <li>
          <strong>Connected social accounts</strong> — the Facebook Page, Instagram
          Business account or YouTube channel you connect, plus the access tokens
          issued by those platforms.
        </li>
        <li>
          <strong>Conversations</strong> — direct messages and comments sent to the
          accounts you connect, including the sender's platform username and
          profile picture, so you can read and reply to them.
        </li>
        <li>
          <strong>Content you create</strong> — posts, captions, media files,
          schedules and automation rules.
        </li>
        <li>
          <strong>Usage records</strong> — sign-in times, actions taken in the
          workspace and error logs, used for security and support.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To show your messages and comments in one inbox and send your replies.</li>
        <li>To run the automation rules you configure.</li>
        <li>To publish and schedule the posts you create.</li>
        <li>To show analytics about your own conversations and posts.</li>
        <li>To keep the Service secure, prevent abuse and provide support.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your data, do not share it with advertisers,
        and do not use platform data for advertising or for training public AI models.
      </p>

      <h2>AI features</h2>
      <p>
        When you use the AI assistant to draft a caption or a reply, the text you
        submit is sent to our AI provider to generate that draft. It is not used to
        train the provider's models.
      </p>

      <h2>Sharing</h2>
      <p>
        Data is shared only with the service providers that run the Service: our
        cloud hosting and database provider, our AI provider (only for the text you
        submit to AI features), and our payment provider (only billing details, never
        your messages). Meta and Google receive the replies and posts you choose to
        send, because that is how they reach your audience. We may disclose data if
        required by law.
      </p>

      <h2>Storage and security</h2>
      <p>
        Data is stored in a managed Postgres database with row-level security, so each
        workspace can read only its own records. Platform access tokens are stored on
        the server only and are never exposed to the browser. Access inside our team
        is limited to administrators who need it for support.
      </p>

      <h2>Retention</h2>
      <p>
        Messages, comments and posts are kept while your workspace is active.
        Disconnecting a social account deletes its stored tokens immediately. Deleting
        your workspace deletes its messages, contacts, posts and automation rules.
        Billing records are kept as long as the law requires.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data at any time from the app,
        or by writing to {SUPPORT_EMAIL}. See our data deletion page for step-by-step
        instructions.
      </p>

      <h2>Children</h2>
      <p>The Service is for businesses and is not intended for anyone under 18.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date above and, for significant
        changes, notify workspace owners by email.
      </p>

      <h2>Contact</h2>
      <p>Techaasvik — {SUPPORT_EMAIL}</p>
    </LegalPage>
  );
}
