/**
 * Delivery page content: ready-made landing-page templates and a safe, tiny
 * text-to-blocks parser (no HTML is ever rendered from user text).
 *
 * Supported writing style (works for templates and hand-typed text):
 *   # Big headline        ## Section title      ### Small title
 *   - bullet point        > highlighted note    ? Question | Answer  (FAQ)
 *   **bold** inside any line.  Blank line = new paragraph.
 */

export type Block =
  | { t: "h1" | "h2" | "h3" | "p" | "quote"; text: string }
  | { t: "list"; items: string[] }
  | { t: "faq"; q: string; a: string };

export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if (m) { flush(); out.push({ t: (["h1", "h2", "h3"] as const)[(m[1] ?? "#").length - 1] ?? "h3", text: m[2] ?? "" }); continue; }
    if (/^[-*•]\s+/.test(line)) {
      flush();
      const item = line.replace(/^[-*•]\s+/, "");
      const last = out[out.length - 1];
      if (last?.t === "list") last.items.push(item); else out.push({ t: "list", items: [item] });
      continue;
    }
    if (line.startsWith(">")) { flush(); out.push({ t: "quote", text: line.replace(/^>\s*/, "") }); continue; }
    if (line.startsWith("?")) {
      flush();
      const [q, ...a] = line.replace(/^\?\s*/, "").split("|");
      out.push({ t: "faq", q: (q ?? "").trim(), a: a.join("|").trim() });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}

/** Splits "**bold** text" into plain/bold pieces. */
export function inlineParts(text: string): { bold: boolean; text: string }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) =>
    p.startsWith("**") && p.endsWith("**") ? { bold: true, text: p.slice(2, -2) } : { bold: false, text: p });
}

export type DeliveryTemplate = { key: string; name: string; hint: string; title: string; slug: string; buttonLabel: string; body: string; priceOriginal?: string; priceOffer?: string };

/** Placeholder content shown in the live preview while the body is still empty. */
export const SAMPLE_BODY = `# Your page headline goes here
A short line that tells visitors what they get and why it matters.

## What you'll get
- **Main benefit** in a few words
- A second reason people love it
- Instant access after you tap the button

## About the creator
Write 2–3 lines about yourself and why people trust you.

> "Customer review appears here." — Happy customer

## Frequently asked questions
? How do I get access? | Tap the button — you get it instantly.
? Who is this for? | Describe your ideal buyer here.`;

export const DELIVERY_TEMPLATES: DeliveryTemplate[] = [
  {
    key: "ebook", name: "Free guide / Ebook", hint: "Lead magnet download", title: "The Instagram Growth Playbook", slug: "free-guide", buttonLabel: "Get it free",
    body: `# The Instagram Growth Playbook 📘
A practical, no-fluff guide to grow your audience with content that actually converts.

## What's inside
- **30 proven content ideas** you can post this week
- Caption and hook templates that drive comments
- A simple weekly posting checklist
- Bonus: DM scripts that turn followers into customers

## Who is this for
- Creators and coaches starting from zero
- Small businesses that want more enquiries

## About the creator
Hi, I'm the creator behind this page. I share what has worked for my own account and my clients — simple steps, no shortcuts.

> "Clear, simple and actually useful. I used three ideas the same day." — A reader

## Frequently asked questions
? Is it really free? | Yes. Enter your email and the guide opens instantly.
? What format is it? | A PDF you can read on phone or laptop.
? Can I share it? | Please share this page link instead so your friend gets their own copy.`,
  },
  {
    key: "course", name: "Course / Masterclass", hint: "Paid video course", title: "Content Creation Masterclass", slug: "masterclass", buttonLabel: "Enroll now", priceOriginal: "2999", priceOffer: "999",
    body: `# Content Creation Masterclass 🎬
Learn to plan, shoot and edit reels that grow your brand — step by step, at your own pace.

## What you'll learn
- Module 1 — **Finding your content niche**
- Module 2 — Hooks, scripts and storytelling
- Module 3 — Shooting and editing on your phone
- Module 4 — Turning views into sales with automation

## What you get
- 4+ hours of recorded lessons
- Templates and worksheets for every module
- Lifetime access, including future updates

## About the creator
I've helped hundreds of creators build a consistent content system. This masterclass is everything I teach my 1-on-1 clients.

> "The hooks module alone doubled my reel views." — Student

## Frequently asked questions
? How long do I have access? | Lifetime access, including updates.
? Do I need a camera? | No, a phone is enough.
? How do I get access after paying? | The access link opens on this page and is also sent to your DM and email.`,
  },
  {
    key: "consult", name: "Booking / Consultation", hint: "1-on-1 call", title: "1-on-1 Strategy Call", slug: "book-a-call", buttonLabel: "Book your call", priceOriginal: "1999", priceOffer: "1499",
    body: `# 1-on-1 Strategy Call 📅
A focused 30-minute video call to review your account and leave with a clear plan.

## What happens on the call
- We review your profile and current results
- You get a **personalised action plan**
- Honest answers to your biggest questions

## Please prepare
- Your website or social handle
- One main goal for the next 90 days

## About the creator
I work with creators and small brands every week on growth and sales strategy.

> "Got more clarity in 30 minutes than in months of trying alone." — Client

## Frequently asked questions
? How do I pick a time? | After booking you choose a slot that suits you.
? Can I reschedule? | Yes, reply to our DM at least 24 hours before your slot.`,
  },
  {
    key: "product", name: "Product purchase", hint: "Digital product / bundle", title: "Creator Template Bundle", slug: "template-bundle", buttonLabel: "Buy now", priceOriginal: "1499", priceOffer: "499",
    body: `# Creator Template Bundle 🎁
Ready-made templates to save hours every week — edit, post and done.

## Your bundle includes
- **50 editable post templates**
- 20 story and reel cover designs
- Content calendar sheet
- Free updates whenever new templates are added

## How it works
- Pay securely on this page
- Get instant download access
- Edit in your favourite free design app

> "Saved me at least 5 hours a week." — Customer

## Frequently asked questions
? How do I receive the files? | Instantly after payment, plus a copy in your DM.
? Can I get a refund? | Please read our refund policy or message us before buying.`,
  },
  {
    key: "coupon", name: "Discount offer", hint: "Coupon / sale page", title: "Your exclusive discount", slug: "special-offer", buttonLabel: "Claim offer", priceOriginal: "999", priceOffer: "599",
    body: `# Your exclusive discount 🎉
Because you commented, you unlocked a **special price** — just for you.

## Why people love it
- Loved by thousands of happy customers
- Fast delivery and easy returns
- Secure payment

> "Great quality and super quick delivery." — Customer

## Frequently asked questions
? How do I use the code? | Copy the code above and apply it at checkout.
? When does the offer end? | The timer on this page shows the exact deadline.`,
  },
];

/** Price box values for a delivery page (display only; charging uses the product price). */
export function priceDisplay(originalPaise: number | null | undefined, offerPaise: number | null | undefined, label?: string | null) {
  const fmt = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const offer = offerPaise && offerPaise > 0 ? offerPaise : null;
  const original = originalPaise && originalPaise > 0 ? originalPaise : null;
  const hasCut = !!(offer && original && offer < original);
  const percent = hasCut ? Math.round(((original! - offer!) / original!) * 100) : 0;
  return {
    offer: offer ? fmt(offer) : original ? fmt(original) : null,
    original: hasCut ? fmt(original!) : null,
    percent,
    badge: label?.trim() || (hasCut ? `${percent}% OFF` : null),
  };
}

export type LeadFieldType = "text" | "email" | "phone" | "pincode" | "choice";
export type LeadField = { key: string; label: string; type: LeadFieldType; required: boolean; options: string[] };

export const STANDARD_LEAD_FIELDS: LeadField[] = [
  { key: "name", label: "Full name", type: "text", required: true, options: [] },
  { key: "phone", label: "Phone number", type: "phone", required: true, options: [] },
  { key: "email", label: "Email address", type: "email", required: true, options: [] },
  { key: "pincode", label: "Pincode", type: "pincode", required: false, options: [] },
];
export const EMAIL_ONLY_FIELDS: LeadField[] = [{ key: "email", label: "Email address", type: "email", required: true, options: [] }];

/** Returns an error message, or null when the value is fine. */
export function validateLeadValue(field: Pick<LeadField, "type" | "required" | "options">, raw: string): string | null {
  const value = raw.trim();
  if (!value) return field.required ? "Please complete all required fields" : null;
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address";
  if (field.type === "phone") { const n = value.replace(/\D/g, "").length; if (n < 10 || n > 15) return "Enter a valid phone number"; }
  if (field.type === "pincode" && !/^\d{6}$/.test(value)) return "Pincode must be 6 digits";
  if (field.type === "choice" && !field.options.includes(value)) return "Choose one of the available options";
  return null;
}

/** Optional trust & compliance details shown on a delivery page (stored inside form_config.extras). */
export type PageExtras = {
  creatorName?: string; supportEmail?: string;
  deliverables?: { count?: string; format?: string; size?: string };
  policies?: { refund?: string; fulfilment?: string; privacy?: string; terms?: string };
  disclaimer?: string;
};

export const DEFAULT_POLICIES = {
  refund: "All sales of digital products are final. If you did not receive access or the file is broken, contact us within 7 days and we will fix it or refund you.",
  fulfilment: "Access is delivered instantly after purchase — on this page, in your DM and by email. You can open it again anytime by signing in with the same email.",
  privacy: "We collect only the details you enter here to deliver your purchase and support you. We never sell your data. You can ask us to delete it anytime.",
  terms: "This product is for your personal use. Sharing, reselling or redistributing it is not allowed. Results depend on your own effort and are not guaranteed.",
};

export const DEFAULT_DISCLAIMER = "The creator is solely responsible for this product and its content. Payments are processed securely by the creator's payment provider.";
