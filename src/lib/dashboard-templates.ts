/** Dashboard "Automation templates" gallery: each card pre-fills the rule editor. */
export type DashCategory = "featured" | "engage" | "sell" | "leads" | "book";
export const DASH_CATEGORIES: { key: DashCategory | "all"; label: string; title: string; sub: string }[] = [
  { key: "all", label: "All", title: "Popular", sub: "The templates most creators start with." },
  { key: "featured", label: "Featured", title: "Featured", sub: "Hand-picked starters that work for almost every account." },
  { key: "engage", label: "Engage audience", title: "Engage audience", sub: "Turn comments and reactions into conversations." },
  { key: "sell", label: "Sell & earn", title: "Sell & earn", sub: "Send prices, coupons and checkout links automatically." },
  { key: "leads", label: "Capture leads", title: "Capture leads", sub: "Give a freebie, collect interest, grow your list." },
  { key: "book", label: "Book clients", title: "Book clients", sub: "Send booking links and enquiry details instantly." },
];

export type DashTemplate = {
  key: string;
  categories: DashCategory[];
  title: string;
  description: string;
  user: string;
  incoming: string;
  reply: string;
  button: string;
  highlight?: boolean;
  trigger: "comment_received" | "dm_received" | "story_reply";
  keywords: string;
  matchType: "contains" | "any";
  requireFollow?: boolean;
  dmText: string;
  comment?: string;
};

export const DASH_TEMPLATES: DashTemplate[] = [
  { key: "link-keyword", categories: ["featured", "sell"], highlight: true, title: "Send link on keyword", description: 'Someone comments "LINK" → they get your link in DMs.', user: "mia.styles", incoming: "Need the LINK please!", reply: "Here's your link!", button: "Shop the look →", trigger: "comment_received", keywords: "link", matchType: "contains", dmText: "Here's your link! Tap below to shop the look 👇", comment: "Sent it to your DMs 📩" },
  { key: "story-reaction", categories: ["featured", "engage"], title: "Send link on story reaction", description: "Someone reacts or replies → they get your link in DMs.", user: "jake.creates", incoming: "reacted to your story", reply: "Here's the link!", button: "Shop now →", trigger: "story_reply", keywords: "", matchType: "any", dmText: "Thanks for the reaction! Here's the link 👇" },
  { key: "follow-gate", categories: ["featured", "engage", "leads"], title: "Require follow before link", description: "Ask them to follow you first. Grow your audience with every link.", user: "alex.fits", incoming: "LINK please!", reply: "Follow me first!", button: "I'm following", trigger: "comment_received", keywords: "link", matchType: "contains", requireFollow: true, dmText: "Thanks for following! Here's your link 👇", comment: "Check your DMs 📩" },
  { key: "dm-auto", categories: ["featured", "sell", "book"], title: "Auto-reply to DMs", description: 'Someone DMs "INFO" or "PRICE" → they get an instant reply.', user: "kate.inquires", incoming: "Hey! What's the PRICE?", reply: "Here's my pricing!", button: "View packages →", trigger: "dm_received", keywords: "info, price", matchType: "contains", dmText: "Hey! Here's my pricing and packages 👇" },
  { key: "giveaway", categories: ["engage"], title: "Giveaway entry", description: 'Someone comments "WIN" → they get entry confirmation in DMs.', user: "riya.loves", incoming: "WIN 🎉", reply: "You're entered! 🎁", button: "See rules →", trigger: "comment_received", keywords: "win, giveaway", matchType: "contains", dmText: "You're in the giveaway! 🎁 Read the rules below and tag a friend to boost your chances.", comment: "You're entered — check DMs 🎉" },
  { key: "community", categories: ["engage"], title: "Community invite", description: 'Someone comments "JOIN" → they get your group invite.', user: "dev.builds", incoming: "JOIN", reply: "Welcome aboard!", button: "Join group →", trigger: "comment_received", keywords: "join, community", matchType: "contains", dmText: "Welcome! Here's the invite to our community 👇", comment: "Invite sent in DM 📩" },
  { key: "coupon", categories: ["sell"], title: "Send discount code", description: 'Someone comments "DISCOUNT" → they get a coupon in DMs.', user: "neha.shops", incoming: "DISCOUNT pls", reply: "Your code: SAVE10", button: "Shop now →", trigger: "comment_received", keywords: "discount, coupon, offer", matchType: "contains", dmText: "Here's your code SAVE10 for 10% off 🎁 Tap below to shop.", comment: "Code sent to your DMs 🎁" },
  { key: "buy-link", categories: ["sell"], title: "Direct checkout link", description: 'Someone comments "BUY" → they get your checkout page.', user: "sam.picks", incoming: "BUY", reply: "Grab it here!", button: "Checkout →", trigger: "comment_received", keywords: "buy, order", matchType: "contains", dmText: "Great choice! Checkout securely here 👇", comment: "Checkout link sent 📩" },
  { key: "freebie", categories: ["leads", "featured"], title: "Free guide / PDF", description: 'Someone comments "GUIDE" → they get your freebie in DMs.', user: "anya.learns", incoming: "GUIDE please 🙏", reply: "Your free guide 📘", button: "Download →", trigger: "comment_received", keywords: "guide, pdf, free", matchType: "contains", dmText: "Here's your free guide 📘 Save this chat so you never lose it!", comment: "Freebie sent to DMs 🎁" },
  { key: "webinar", categories: ["leads"], title: "Webinar registration", description: 'Someone comments "LIVE" → they get the sign-up link.', user: "rohan.grows", incoming: "LIVE", reply: "Save your seat!", button: "Register →", trigger: "comment_received", keywords: "live, webinar, register", matchType: "contains", dmText: "Seats are limited — register for the live session here 👇", comment: "Registration link in DM 📩" },
  { key: "waitlist", categories: ["leads"], title: "Join the waitlist", description: 'Someone comments "EARLY" → they get early access sign-up.', user: "zoe.waits", incoming: "EARLY access?", reply: "You're early 🔥", button: "Join waitlist →", trigger: "comment_received", keywords: "early, waitlist", matchType: "contains", dmText: "You're early! Join the waitlist below to get first access 🔥", comment: "Waitlist link sent 📩" },
  { key: "call", categories: ["book"], title: "Book a discovery call", description: 'Someone comments "CALL" → they get your booking link.', user: "maya.coach", incoming: "Can I book a CALL?", reply: "Pick a time!", button: "Book call →", trigger: "comment_received", keywords: "call, book", matchType: "contains", dmText: "Happy to chat! Pick a time that suits you 👇", comment: "Booking link sent to DMs 📅" },
  { key: "portfolio", categories: ["book"], title: "Share portfolio", description: 'Someone comments "WORK" → they get your portfolio and rates.', user: "leo.hires", incoming: "Show your WORK", reply: "My portfolio ✨", button: "View work →", trigger: "comment_received", keywords: "work, portfolio", matchType: "contains", dmText: "Here's my portfolio and rates ✨ Reply if you'd like a quote.", comment: "Portfolio sent in DM 📩" },
  { key: "quote", categories: ["book"], title: "Quote request", description: 'Someone DMs "QUOTE" → they get your enquiry form.', user: "priya.plans", incoming: "Need a QUOTE", reply: "Tell me more!", button: "Get quote →", trigger: "dm_received", keywords: "quote, estimate", matchType: "contains", dmText: "Sure! Fill this quick form and I'll send your quote 👇" },
];

export function templatesFor(cat: DashCategory | "all"): DashTemplate[] {
  if (cat === "all") return DASH_TEMPLATES.filter((t) => t.categories.includes("featured")).concat(DASH_TEMPLATES.filter((t) => !t.categories.includes("featured")));
  return DASH_TEMPLATES.filter((t) => t.categories.includes(cat));
}
