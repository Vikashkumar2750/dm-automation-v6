const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

type SendResult = { status: "sent" | "failed" | "pending"; error: string | null };

/** Gateway mode on Lovable Cloud (both keys); direct Resend API on Railway (RESEND_API_KEY only). */
function gatewayKeys() {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const connectionKey = process.env['RESEND_API_KEY'];
  if (!connectionKey) return null;
  return { lovableKey: lovableKey || null, connectionKey };
}

function fromAddress(senderName: string) {
  const from = process.env['RESEND_FROM_EMAIL']?.trim() || "onboarding@resend.dev";
  return `${senderName || "AutoDM"} <${from}>`;
}

async function sendViaResend(payload: {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  reply_to?: string;
}): Promise<SendResult> {
  const keys = gatewayKeys();
  if (!keys) return { status: "pending", error: null };
  const direct = !keys.lovableKey || keys.connectionKey.startsWith("re_");
  const response = await fetch(direct ? "https://api.resend.com/emails" : `${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: direct
      ? { "Content-Type": "application/json", Authorization: `Bearer ${keys.connectionKey}` }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keys.lovableKey}`,
          "X-Connection-Api-Key": keys.connectionKey,
        },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Resend gateway failed [${response.status}]: ${body}`);
    return { status: "failed", error: `Email provider returned ${response.status}: ${body.slice(0, 160)}` };
  }
  return { status: "sent", error: null };
}

type InquiryEmail = {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
};

export async function sendInquiryAlert(input: InquiryEmail, recipient: string, senderName: string) {
  if (!recipient || !gatewayKeys()) return { status: "pending" as const, error: null };
  return sendViaResend({
    from: fromAddress(senderName),
    to: [recipient],
    reply_to: input.email,
    subject: `[Support] ${input.subject}`,
    text: [
      `New ${input.category} inquiry`,
      `From: ${input.name} <${input.email}>`,
      "",
      input.message,
    ].join("\n"),
  });
}

export function emailProviderReady() {
  return Boolean(gatewayKeys());
}

export async function sendTestEmail(recipient: string, senderName: string) {
  if (!gatewayKeys()) {
    return { ok: false, error: "Email sending is not set up yet (Resend connection missing)." };
  }
  if (!recipient) return { ok: false, error: "Add an admin alert email first." };
  const res = await sendViaResend({
    from: fromAddress(senderName),
    to: [recipient],
    subject: "AutoDM test email",
    text: "Your email settings are working.",
  });
  if (res.status !== "sent") return { ok: false, error: res.error ?? "Failed" };
  return { ok: true, error: null };
}

/** Plain transactional email (e.g. buyer sign-in codes). */
export async function sendPlainEmail(to: string, subject: string, text: string, senderName = "AutoDM") {
  return sendViaResend({ from: fromAddress(senderName), to: [to], subject, text });
}
