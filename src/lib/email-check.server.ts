/** True when the email's domain can receive mail (MX or A record). Fails open if DNS lookup itself errors. */
export async function emailDomainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const ask = async (type: string) => {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, {
      headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) throw new Error("dns");
    const j = (await r.json()) as { Status: number; Answer?: unknown[] };
    return j.Status === 0 && (j.Answer?.length ?? 0) > 0;
  };
  try { return (await ask("MX")) || (await ask("A")); } catch { return true; }
}

export async function assertRealEmails(clean: Record<string, string>, fields: Array<{ key: string; type: string }>) {
  for (const f of fields) {
    const v = clean[f.key];
    if (f.type === "email" && v && !(await emailDomainAcceptsMail(v))) throw new Error("This email address can't receive mail — please check it");
  }
}
