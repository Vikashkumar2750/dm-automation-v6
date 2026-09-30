type InquiryEmail = {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
};

export async function sendInquiryAlert(input: InquiryEmail, recipient: string, senderName: string) {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['RESEND_FROM_EMAIL'];
  if (!apiKey || !from || !recipient) return { status: "pending" as const, error: null };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${senderName} <${from}>`,
      to: [recipient],
      reply_to: input.email,
      subject: `[Support] ${input.subject}`,
      text: [
        `New ${input.category} inquiry`,
        `From: ${input.name} <${input.email}>`,
        "",
        input.message,
      ].join("\n"),
    }),
  });
  if (!response.ok) return { status: "failed" as const, error: `Email provider returned ${response.status}` };
  return { status: "sent" as const, error: null };
}
export function emailProviderReady() {
  return Boolean(process.env['RESEND_API_KEY'] && process.env['RESEND_FROM_EMAIL']);
}

export async function sendTestEmail(recipient: string, senderName: string) {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['RESEND_FROM_EMAIL'];
  if (!apiKey || !from) return { ok: false, error: "Email sending is not set up yet (RESEND_API_KEY / RESEND_FROM_EMAIL missing)." };
  if (!recipient) return { ok: false, error: "Add an admin alert email first." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${senderName} <${from}>`,
      to: [recipient],
      subject: "AutoDM test email",
      text: "Your email settings are working.",
    }),
  });
  if (!res.ok) return { ok: false, error: `Email provider returned ${res.status}: ${(await res.text()).slice(0, 160)}` };
  return { ok: true, error: null };
}
