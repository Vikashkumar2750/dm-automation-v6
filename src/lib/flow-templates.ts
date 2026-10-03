import { newStepId, type Flow, type FlowStep } from "@/lib/flows";

/** Ready-to-use flows. Each is created as a Draft so nothing sends until the user switches it on. */
type Tpl = { key: string; name: string; description: string; trigger: Flow["trigger"]; steps: StepNoId[] };
type StepNoId = FlowStep extends infer S ? (S extends FlowStep ? Omit<S, "id"> : never) : never;

export const FLOW_TEMPLATES: Tpl[] = [
  {
    key: "price",
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
    name: "Story mention shout-out",
    description: "Thanks people who mention you in their story.",
    trigger: "story_mention",
    steps: [
      { kind: "send_dm", text: "Thank you so much for the mention! 🙌 Here's a little thank-you code: THANKS10" },
      { kind: "tag", value: "mentioned-us" },
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
