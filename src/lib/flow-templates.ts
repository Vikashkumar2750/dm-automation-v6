import { newStepId, type Flow, type FlowStep } from "@/lib/flows";

/** Ready-to-use flows. Each is created as a Draft so nothing sends until the user switches it on. */
export type TemplateCategory = "all_in_one" | "sales" | "leads" | "followers" | "engagement" | "support";
export const TEMPLATE_CATEGORIES: { key: TemplateCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "all_in_one", label: "All-in-one" },
  { key: "sales", label: "Sales & payments" },
  { key: "leads", label: "Lead capture" },
  { key: "followers", label: "Followers" },
  { key: "engagement", label: "Engagement" },
  { key: "support", label: "Support" },
];
type Tpl = { key: string; category: TemplateCategory; name: string; description: string; trigger: Flow["trigger"]; steps: StepNoId[] };
type StepNoId = FlowStep extends infer S ? (S extends FlowStep ? Omit<S, "id"> : never) : never;
const PROFILE = "https://instagram.com/yourprofile";

export const FLOW_TEMPLATES: Tpl[] = [
  {
    key: "all_in_one",
    category: "all_in_one",
    name: "All-in-one: comment → follow → sell → capture lead",
    description: "Every step ready. Switch any step off with its toggle — e.g. turn off the follow check or the payment link.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "price, link, buy, details, info" },
      { kind: "condition", check: "no_tag", value: "do-not-contact" },
      { kind: "public_reply", text: "Sent you everything in DM 📩" },
      { kind: "follow_gate", text: "Please follow us first to unlock the details 🙏 Then comment again!", buttonTitle: "Visit profile", profileUrl: PROFILE },
      { kind: "tag", value: "follower" },
      { kind: "send_dm", text: "Thanks for following! Here are the details 👇", buttonTitle: "See details", buttonUrl: "https://example.com" },
      { kind: "tag", value: "hot-lead" },
      { kind: "send_payment", productId: "", text: "Want it now? Pay securely here 👇", disabled: true },
      { kind: "send_coupon", campaignId: "", text: "Special for you: use code {code} for a discount 🎁", disabled: true },
      { kind: "wait", minutes: 60 },
      { kind: "condition", check: "has_contact", value: "none" },
      { kind: "ask_contact", text: "Can I send you offers on WhatsApp or email? Just reply with your number or email 😊" },
      { kind: "tag", value: "lead-followup" },
    ],
  },
  {
    key: "sell_pay",
    category: "sales",
    name: "Comment BUY → payment link",
    description: "Public reply, DM with a payment link, then a reminder if they haven't paid.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "buy, order, want" },
      { kind: "public_reply", text: "Payment link sent in DM 🛒" },
      { kind: "send_payment", productId: "", text: "Here is your secure payment link 👇" },
      { kind: "tag", value: "interested-buyer" },
      { kind: "wait", minutes: 120 },
      { kind: "condition", check: "no_tag", value: "paid-customer" },
      { kind: "send_dm", text: "Still thinking? Your link is above — reply if you have any questions 🙂" },
      { kind: "tag", value: "cart-abandoned" },
    ],
  },
  {
    key: "coupon",
    category: "sales",
    name: "Comment OFFER → personal coupon",
    description: "Gives each person a unique discount code and tags them.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "offer, discount, coupon, code" },
      { kind: "condition", check: "no_tag", value: "discount-claimed" },
      { kind: "public_reply", text: "Your code is in DM 🎁" },
      { kind: "send_coupon", campaignId: "", text: "Here's your personal code: {code} 🎉" },
      { kind: "tag", value: "discount-claimed" },
    ],
  },
  {
    key: "follow_unlock",
    category: "followers",
    name: "Non-follower → Visit profile, follower → link",
    description: "Non-followers get a Visit profile button; followers get the link straight away.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "link, free, guide" },
      { kind: "follow_gate", text: "Follow us to unlock the link 🔓 then comment again!", buttonTitle: "Visit profile", profileUrl: PROFILE },
      { kind: "send_dm", text: "Here's your link 🔗", buttonTitle: "Open link", buttonUrl: "https://example.com" },
      { kind: "tag", value: "follower-exclusive" },
    ],
  },
  {
    key: "giveaway",
    category: "engagement",
    name: "Giveaway entry",
    description: "Comment-to-enter giveaway for followers, with an entry tag.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "giveaway, enter, win" },
      { kind: "condition", check: "no_tag", value: "giveaway-entry" },
      { kind: "follow_gate", text: "You must follow us to enter 🙌 then comment again.", buttonTitle: "Visit profile", profileUrl: PROFILE },
      { kind: "public_reply", text: "You're in! Good luck 🍀" },
      { kind: "send_dm", text: "Your giveaway entry is confirmed ✅ Winners announced soon!" },
      { kind: "tag", value: "giveaway-entry" },
    ],
  },
  {
    key: "webinar",
    category: "leads",
    name: "Webinar / event signup",
    description: "Sends the registration link and asks for email for reminders.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "webinar, live, register, event" },
      { kind: "public_reply", text: "Registration link sent in DM 🎥" },
      { kind: "send_dm", text: "Here's the registration link 👇", buttonTitle: "Register", buttonUrl: "https://example.com/webinar" },
      { kind: "condition", check: "has_contact", value: "none" },
      { kind: "ask_contact", text: "Reply with your email and we'll send you a reminder before we go live ⏰" },
      { kind: "tag", value: "webinar-attendee" },
    ],
  },
  {
    key: "support",
    category: "support",
    name: "Support / complaint DM",
    description: "Acknowledges support messages and tags them for the team.",
    trigger: "new_dm",
    steps: [
      { kind: "condition", check: "contains", value: "help, problem, issue, refund, complaint, not working" },
      { kind: "send_dm", text: "Sorry about that 🙏 Our team has your message and will reply shortly." },
      { kind: "tag", value: "support-needed" },
    ],
  },
  {
    key: "repeat_customer",
    category: "sales",
    name: "Thank paid customers",
    description: "When a paid customer DMs, thank them and offer a repeat discount.",
    trigger: "new_dm",
    steps: [
      { kind: "condition", check: "has_tag", value: "paid-customer" },
      { kind: "send_dm", text: "Great to hear from you again 💛 As a customer you get 10% off your next order!" },
      { kind: "tag", value: "repeat-customer" },
    ],
  },
  {
    key: "price",
    category: "sales",
    name: "Price enquiry → DM",
    description: "Comment says price/cost: reply publicly and DM the price link.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "price, cost, rate, kitna, how much" },
      { kind: "public_reply", text: "Thanks for asking! Sent you the details in DM 📩" },
      { kind: "send_dm", text: "Hi! Here are the price details you asked for 👇", buttonTitle: "See prices", buttonUrl: "https://example.com/pricing" },
      { kind: "tag", value: "price-lead" },
    ],
  },
  {
    key: "link",
    category: "engagement",
    name: "Comment LINK → send link",
    description: "Classic comment-to-DM: anyone commenting LINK gets the link in DM.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "link" },
      { kind: "public_reply", text: "Check your DMs 🔗" },
      { kind: "send_dm", text: "Here is the link you asked for!", buttonTitle: "Open link", buttonUrl: "https://example.com" },
    ],
  },
  {
    key: "follower",
    category: "followers",
    name: "Followers-only freebie",
    description: "Send the freebie to followers; ask non-followers to follow first.",
    trigger: "new_comment",
    steps: [
      { kind: "condition", check: "contains", value: "free, guide, pdf" },
      { kind: "condition", check: "is_follower", value: "yes" },
      { kind: "send_dm", text: "Thanks for following! Here is your free guide 🎁", buttonTitle: "Download", buttonUrl: "https://example.com/guide" },
      { kind: "tag", value: "freebie" },
    ],
  },
  {
    key: "welcome",
    category: "engagement",
    name: "DM welcome + follow-up",
    description: "Greets a new DM, waits 30 minutes, then sends a gentle follow-up.",
    trigger: "new_dm",
    steps: [
      { kind: "condition", check: "contains", value: "hi, hello, hey, namaste" },
      { kind: "send_dm", text: "Hi! 👋 Thanks for messaging. How can we help you today?" },
      { kind: "wait", minutes: 30 },
      { kind: "send_dm", text: "Just checking in — reply here anytime and our team will help." },
    ],
  },
  {
    key: "story_reply",
    category: "engagement",
    name: "Story reply thank-you",
    description: "Thanks people who reply to your story and tags them as engaged.",
    trigger: "story_reply",
    steps: [
      { kind: "send_dm", text: "Thanks for replying to our story! 💛 Anything you'd like to know?" },
      { kind: "tag", value: "story-engaged" },
    ],
  },
  {
    key: "story_mention",
    category: "engagement",
    name: "Story mention shout-out",
    description: "Thanks people who mention you in their story.",
    trigger: "story_mention",
    steps: [
      { kind: "send_dm", text: "Thank you so much for the mention! 🙌 Here's a little thank-you code: THANKS10" },
      { kind: "tag", value: "mentioned-us" },
    ],
  },
  {
    key: "capture",
    category: "leads",
    name: "Collect email / phone",
    description: "Asks for an email or WhatsApp number on keyword DETAILS; the reply is saved to the contact automatically.",
    trigger: "new_dm",
    steps: [
      { kind: "condition", check: "contains", value: "details, info, catalog" },
      { kind: "send_dm", text: "Sure! 😊 Reply with your email or WhatsApp number and we'll send the full details." },
      { kind: "tag", value: "lead" },
    ],
  },
];

export function flowFromTemplate(key: string): Flow | null {
  const t = FLOW_TEMPLATES.find((x) => x.key === key);
  if (!t) return null;
  return {
    id: newStepId(),
    name: t.name,
    active: false,
    platform: "both",
    trigger: t.trigger,
    steps: t.steps.map((s) => ({ ...s, id: newStepId() }) as FlowStep),
    updatedAt: new Date().toISOString(),
  };
}

/** Pre-built ice breaker / menu packs for Social Accounts. */
export const ENTRY_PRESETS: { key: string; label: string; questions: string[]; menu: { title: string; url: string }[] }[] = [
  {
    key: "shop",
    label: "Online shop",
    questions: ["What are your prices?", "How long does delivery take?", "Do you offer cash on delivery?", "How can I track my order?"],
    menu: [{ title: "Shop now", url: "https://example.com" }, { title: "Track order", url: "" }, { title: "Talk to us", url: "" }],
  },
  {
    key: "creator",
    label: "Creator / coach",
    questions: ["How can I work with you?", "Send me the free guide", "What courses do you offer?", "Collaboration enquiry"],
    menu: [{ title: "Free guide", url: "" }, { title: "Courses", url: "https://example.com/courses" }, { title: "Collab", url: "" }],
  },
  {
    key: "services",
    label: "Local business / services",
    questions: ["What are your opening hours?", "Where are you located?", "Book an appointment", "What services do you offer?"],
    menu: [{ title: "Book now", url: "https://example.com/book" }, { title: "Location", url: "" }, { title: "Services", url: "" }],
  },
];
