/** Emails tied to one buyer/lead event: receipt, lead confirmation, creator alerts. Never bulk. */
type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

async function ready(orgId: string) {
  const { emailProviderReady } = await import("@/lib/support-email.server");
  if (!emailProviderReady()) return false;
  const f = await (await import("@/lib/workspace-features.server")).workspaceFeaturesFor(orgId);
  return f.emails === "enabled";
}

async function ownerEmail(admin: AdminClient, orgId: string): Promise<string | null> {
  const { data: m } = await admin.from("organization_members").select("user_id").eq("organization_id", orgId).eq("role", "owner").limit(1).maybeSingle();
  if (!m) return null;
  const { data: p } = await admin.from("profiles").select("email").eq("id", m.user_id).maybeSingle();
  return (p?.email as string | null) ?? null;
}

function creatorOf(cfg: unknown) {
  const x = (cfg as { extras?: { creatorName?: string; supportEmail?: string } } | null)?.extras ?? {};
  return { name: (x.creatorName ?? "").trim() || "AutoDM", support: (x.supportEmail ?? "").trim() || undefined };
}

/** Receipt with breakdown + creator sale alert. Called once per paid link (guarded by the created→paid flip). */
export async function sendPurchaseEmails(admin: AdminClient, opts: { pageId: string; email: string; amountPaise: number; origin: string; providerLinkId?: string | null; notes?: Record<string, string> | null }) {
  try {
    const { data: page } = await admin.from("delivery_pages").select("organization_id, title, slug, form_config").eq("id", opts.pageId).maybeSingle();
    if (!page || !(await ready(page.organization_id as string))) return;
    const { sendBrandedEmail } = await import("@/lib/support-email.server");
    const c = creatorOf(page.form_config);
    const url = `${opts.origin.replace(/\/$/, "")}/p/${page.slug}`;
    const n = opts.notes ?? {};
    const rows: Array<[string, string]> = [["Product", page.title as string]];
    if (n["price_paise"]) rows.push(["Price", inr(Number(n["price_paise"]))]);
    if (n["coupon"]) rows.push(["Coupon", n["coupon"]]);
    if (Number(n["gst_paise"]) > 0) rows.push(["GST", inr(Number(n["gst_paise"]))]);
    if (Number(n["fee_paise"]) > 0) rows.push(["Processing fee", inr(Number(n["fee_paise"]))]);
    rows.push(["Total paid", inr(opts.amountPaise)]);
    if (opts.providerLinkId) rows.push(["Payment reference", opts.providerLinkId]);
    await sendBrandedEmail(opts.email, `Your purchase: ${page.title}`, {
      heading: "Payment successful 🎉",
      lines: [`Thank you! Your purchase of "${page.title}" is confirmed.`, `Open your content any time: tap "Sign in" on the page and use this email (${opts.email}) to get a one-time code.`],
      rows, cta: { label: "Access your content", url }, footer: "Keep this email as your receipt.", ...(c.support ? { replyTo: c.support } : {}),
    }, c.name);
    const owner = await ownerEmail(admin, page.organization_id as string);
    if (owner) await sendBrandedEmail(owner, `New sale: ${inr(opts.amountPaise)} — ${page.title}`, {
      heading: "You made a sale",
      lines: [`${opts.email} bought "${page.title}".`],
      rows: [["Amount", inr(opts.amountPaise)], ...(n["coupon"] ? [["Coupon", n["coupon"]] as [string, string]] : [])],
      cta: { label: "Open Sales & Revenue", url: `${opts.origin.replace(/\/$/, "")}/revenue` },
    }, "AutoDM");
  } catch (e) { console.error("purchase emails failed", e); }
}

/** Lead form confirmation to the person who filled it + new-lead alert to the creator. */
export async function sendLeadEmails(admin: AdminClient, opts: { pageId: string; leadId: string; answers: Record<string, string>; origin: string; checkout: boolean }) {
  try {
    const { data: page } = await admin.from("delivery_pages").select("organization_id, title, slug, form_config").eq("id", opts.pageId).maybeSingle();
    if (!page || !(await ready(page.organization_id as string))) return;
    const { sendBrandedEmail } = await import("@/lib/support-email.server");
    const c = creatorOf(page.form_config);
    const url = `${opts.origin.replace(/\/$/, "")}/p/${page.slug}`;
    const email = opts.answers["email"];
    // Paid pages: the receipt is the confirmation, so only free/lead pages get this one.
    if (email && !opts.checkout) await sendBrandedEmail(email, `Thanks — ${page.title}`, {
      heading: `Thanks${opts.answers["name"] ? `, ${opts.answers["name"]}` : ""}!`,
      lines: [`We received your details for "${page.title}".`, "You can come back to the page any time using the button below."],
      cta: { label: "Open the page", url }, ...(c.support ? { replyTo: c.support } : {}),
    }, c.name);
    const owner = await ownerEmail(admin, page.organization_id as string);
    if (owner) await sendBrandedEmail(owner, `New lead: ${page.title}`, {
      heading: "New lead on your delivery page",
      lines: [`Someone filled the form on "${page.title}".`],
      rows: Object.entries(opts.answers).filter(([k]) => !k.startsWith("_")).slice(0, 8).map(([k, v]) => [k, v]),
      cta: { label: "Open Contacts", url: `${opts.origin.replace(/\/$/, "")}/contacts` },
    }, "AutoDM");
  } catch (e) { console.error("lead emails failed", e); }
}
