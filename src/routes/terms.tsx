import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, SUPPORT_EMAIL } from "@/components/app/LegalPage";

const title = "Terms of Service — AutoDM by Techaasvik";
const description =
  "The terms for using AutoDM by Techaasvik: accounts, acceptable use, platform rules, payments, and cancellation.";

export const Route = createFileRoute("/terms")({
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
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="21 September 2026">
      <p>
        By creating a workspace on AutoDM by Techaasvik ("the Service") you agree
        to these terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older and act on behalf of a business you represent.</li>
        <li>You are responsible for keeping your password safe and for what your invited team members do.</li>
        <li>You may only connect social accounts you own or are authorised to manage.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>No spam, bulk unsolicited messaging, or messaging people who did not contact the business first.</li>
        <li>No illegal, hateful, misleading or adult content.</li>
        <li>No attempts to break, overload, reverse engineer or gain unauthorised access to the Service.</li>
        <li>You must honour opt-out requests from the people who message you.</li>
      </ul>

      <h2>Platform rules</h2>
      <p>
        Use of the Service must also follow Meta's and Google/YouTube's platform terms
        and developer policies. Those platforms can limit or suspend access to your
        accounts, and we are not responsible for their decisions or for outages,
        API changes or policy changes on their side.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of your content and your customers' messages. You grant us
        only the permission needed to store, process and deliver it while providing the
        Service.
      </p>

      <h2>Payments</h2>
      <p>
        Paid plans are billed through our payment provider at the prices shown on the
        pricing page. Subscription plans renew for the period you select until you
        cancel; one-time plans do not renew. Prices may change with notice before your
        next renewal. Except where the law requires otherwise, payments already made
        are non-refundable.
      </p>

      <h2>Cancellation and suspension</h2>
      <p>
        You can stop using the Service and delete your workspace at any time. We may
        suspend or end access if these terms are broken, if a platform requires it, or
        if usage puts the Service or other customers at risk.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The Service is provided "as is". We work to keep it available but do not
        guarantee uninterrupted service. To the maximum extent permitted by law, our
        total liability is limited to the amount you paid us in the three months before
        the claim, and we are not liable for indirect or consequential losses such as
        lost profit or lost leads.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; the date above will change and continued use means
        you accept the update.
      </p>

      <h2>Governing law and contact</h2>
      <p>
        These terms are governed by the laws of India, with courts in India having
        jurisdiction. Questions: {SUPPORT_EMAIL}
      </p>
    </LegalPage>
  );
}
