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
    if (m) { flush(); out.push({ t: (["h1", "h2", "h3"] as const)[m[1].length - 1], text: m[2] }); continue; }
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
      out.push({ t: "faq", q: q.trim(), a: a.join("|").trim() });
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

export type DeliveryTemplate = { key: string; name: string; hint: string; title: string; slug: string; buttonLabel: string; body: string };

export const DELIVERY_TEMPLATES: DeliveryTemplate[] = [
  {
    key: "ebook", name: "Free guide / Ebook", hint: "Lead magnet download", title: "Your free guide is ready", slug: "free-guide", buttonLabel: "Download the guide",
    body: `# Your free guide is ready 🎉
Thanks for joining! Everything you asked for is one tap away.

## What's inside
- **Step-by-step plan** you can start today
- Real examples and ready-to-use checklists
- Bonus tips we share only with our community

> Tip: save this page so you can come back anytime.

## How to get it
Tap the button below. The guide opens instantly — no sign-up needed.

## Questions
? Is it really free? | Yes, 100% free. No card needed.
? Can I share it? | Please share the page link with a friend instead.`,
  },
  {
    key: "course", name: "Course / Masterclass", hint: "Access to videos", title: "Welcome to the masterclass", slug: "masterclass", buttonLabel: "Start watching",
    body: `# Welcome to the masterclass 🚀
Your access is confirmed. Here's how to get the most out of it.

## What you'll learn
- Module 1 — **The foundations**
- Module 2 — Building your system
- Module 3 — Growing faster with automation

## Before you start
- Use headphones for the best experience
- Keep a notebook handy for the action steps

> Join our private community to ask questions and get feedback.

## FAQ
? How long do I have access? | Lifetime access, including future updates.
? I can't open the videos | Reply to our DM and we'll fix it fast.`,
  },
  {
    key: "consult", name: "Booking / Consultation", hint: "Book a call", title: "Book your consultation", slug: "book-a-call", buttonLabel: "Pick a time",
    body: `# Let's talk about your goals 📅
Your spot is reserved. Choose a time that works for you.

## What happens on the call
- We understand your current situation
- You get a **clear action plan**
- No pressure — just honest advice

## Please prepare
- Your website or social handle
- One main goal for the next 90 days

> Can't find a slot? Reply to our DM and we'll make one for you.`,
  },
  {
    key: "product", name: "Product purchase", hint: "Thank-you after payment", title: "Thank you for your purchase", slug: "thank-you", buttonLabel: "Get your files",
    body: `# Thank you for your order 💛
Your payment was successful. Your product is ready below.

## Your order includes
- **Instant download** of all files
- Free updates
- Priority support by DM

## Next steps
1. Tap the button to download
2. Unzip and follow the quick-start file

> Keep this link private — it's just for you.

## Need help?
? I didn't get my files | Tap the button again or reply to our DM.
? Can I get a refund? | Please check our refund policy or message us.`,
  },
  {
    key: "coupon", name: "Discount offer", hint: "Coupon / sale page", title: "Your exclusive discount", slug: "special-offer", buttonLabel: "Shop now",
    body: `# Your exclusive discount 🎁
Because you commented, you unlocked a **special price** — just for you.

## Why people love it
- Loved by thousands of happy customers
- Fast delivery and easy returns
- Secure payment

> Offer ends soon. Use your code at checkout.`,
  },
];
