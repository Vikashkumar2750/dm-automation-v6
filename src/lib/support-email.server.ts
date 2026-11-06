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

/** Branded HTML email (plain-text copy included). Values are escaped. */
export async function sendBrandedEmail(to: string, subject: string, opts: { heading: string; lines: string[]; rows?: Array<[string, string]>; cta?: { label: string; url: string }; footer?: string; replyTo?: string }, senderName = "AutoDM") {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const rows = (opts.rows ?? []).map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748b">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a">${esc(v)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 24px">
<p style="margin:0 0 18px;font-size:13px;font-weight:700;color:#2563eb">${esc(senderName)}</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a">${esc(opts.heading)}</h1>
${opts.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">${esc(l)}</p>`).join("")}
${rows ? `<table style="width:100%;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:16px 0;font-size:14px;border-collapse:collapse">${rows}</table>` : ""}
${opts.cta ? `<p style="margin:22px 0"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${esc(opts.cta.label)}</a></p>` : ""}
<p style="margin:24px 0 0;font-size:12px;color:#94a3b8">${esc(opts.footer ?? "Sent with AutoDM by Techaasvik")}</p>
</div></body></html>`;
  const text = [opts.heading, "", ...opts.lines, "", ...(opts.rows ?? []).map(([k, v]) => `${k}: ${v}`), ...(opts.cta ? ["", `${opts.cta.label}: ${opts.cta.url}`] : [])].join("\n");
  return sendViaResend({ from: fromAddress(senderName), to: [to], subject, html, text, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) });
}
