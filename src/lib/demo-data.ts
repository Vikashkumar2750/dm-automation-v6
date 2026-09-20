// Phase 1 demo data. Replaced by real tenant data in Phase 2+.

export type Platform = "instagram" | "facebook" | "youtube";

export const platformLabel: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
};

export const workspaces = [
  { id: "ws_1", name: "Tech Aasvik Media", plan: "Business Plan" },
  { id: "ws_2", name: "BrandBoost Agency", plan: "Agency Plan" },
  { id: "ws_3", name: "FitLife India", plan: "Starter Plan" },
];

export const currentUser = {
  name: "Vikas Sharma",
  email: "vikas@techaasvik.com",
  plan: "Business Plan",
  initials: "VS",
};

export const kpis = [
  { label: "Total Conversations", value: "4,821", delta: "+12%", sub: "vs last 7 days" },
  { label: "Comments Received", value: "2,964", delta: "+18%", sub: "Across all platforms" },
  { label: "Automated Replies", value: "2,381", delta: "+14%", sub: "82% automation rate" },
  { label: "Qualified Leads", value: "482", delta: "+28%", sub: "From 9 automations" },
  { label: "Posts Published", value: "24", delta: "+9%", sub: "Across all platforms" },
  { label: "Conversion Rate", value: "6.3%", delta: "+22%", sub: "From conversations" },
];

export const engagementSeries = [
  { day: "Dec 1", instagram: 420, facebook: 300, youtube: 140 },
  { day: "Dec 2", instagram: 510, facebook: 340, youtube: 160 },
  { day: "Dec 3", instagram: 470, facebook: 360, youtube: 150 },
  { day: "Dec 4", instagram: 620, facebook: 432, youtube: 198 },
  { day: "Dec 5", instagram: 700, facebook: 410, youtube: 210 },
  { day: "Dec 6", instagram: 810, facebook: 470, youtube: 230 },
  { day: "Dec 7", instagram: 900, facebook: 520, youtube: 240 },
];

export const connectedAccounts: {
  platform: Platform;
  handle: string;
  status: "connected" | "attention" | "disconnected";
  metric: string;
  metricLabel: string;
  capabilities: { name: string; enabled: boolean }[];
}[] = [
  {
    platform: "instagram",
    handle: "@techaasvik",
    status: "connected",
    metric: "12.4K",
    metricLabel: "Followers",
    capabilities: [
      { name: "Comments", enabled: true },
      { name: "Private Replies", enabled: true },
      { name: "Messaging", enabled: true },
      { name: "Publishing", enabled: true },
      { name: "Insights", enabled: true },
    ],
  },
  {
    platform: "facebook",
    handle: "Techaasvik",
    status: "connected",
    metric: "8.6K",
    metricLabel: "Page Followers",
    capabilities: [
      { name: "Comments", enabled: true },
      { name: "Private Replies", enabled: true },
      { name: "Messaging", enabled: true },
      { name: "Publishing", enabled: true },
      { name: "Insights", enabled: true },
    ],
  },
  {
    platform: "youtube",
    handle: "Techaasvik",
    status: "connected",
    metric: "24.3K",
    metricLabel: "Subscribers",
    capabilities: [
      { name: "Comments", enabled: true },
      { name: "Replies", enabled: true },
      { name: "Publishing", enabled: true },
      { name: "Analytics", enabled: true },
      { name: "Live Streaming", enabled: false },
    ],
  },
];

export const conversations: {
  name: string;
  platform: Platform;
  preview: string;
  time: string;
  state: "Replied" | "Pending" | "Replied (Private)";
}[] = [
  { name: "Riya Mehta", platform: "instagram", preview: "Price details please?", time: "2m ago", state: "Replied (Private)" },
  { name: "Amit Kumar", platform: "facebook", preview: "Do you have this in stock?", time: "5m ago", state: "Replied" },
  { name: "Neha Verma", platform: "instagram", preview: "Link please", time: "12m ago", state: "Pending" },
  { name: "Karan Sinha", platform: "youtube", preview: "Great video! Can you make a tutorial?", time: "18m ago", state: "Replied" },
  { name: "Priya Shah", platform: "instagram", preview: "Is COD available?", time: "24m ago", state: "Replied" },
];

export const topAutomations = [
  { name: "Instagram Comment → Private Reply", runs: 1482, delta: "+38%", share: 100 },
  { name: "Keyword: Price → DM Flow", runs: 642, delta: "+16%", share: 44 },
  { name: "Story Mention → Auto Reply", runs: 521, delta: "+13%", share: 36 },
  { name: "Facebook Comment → Reply", runs: 418, delta: "+11%", share: 29 },
  { name: "YouTube Comment → Reply", runs: 312, delta: "+8%", share: 22 },
];

export const upcomingPosts: { title: string; platform: Platform; when: string; status: string }[] = [
  { title: "New Product Launch", platform: "instagram", when: "Dec 7, 2025 at 10:30 AM", status: "Scheduled" },
  { title: "Client Testimonial", platform: "facebook", when: "Dec 7, 2025 at 02:00 PM", status: "Scheduled" },
  { title: "How to Use – Tutorial", platform: "youtube", when: "Dec 8, 2025 at 11:00 AM", status: "Scheduled" },
  { title: "Festival Offer", platform: "instagram", when: "Dec 8, 2025 at 05:30 PM", status: "Scheduled" },
  { title: "Tips & Tricks", platform: "facebook", when: "Dec 9, 2025 at 09:00 AM", status: "Scheduled" },
];

export const usageMeters = [
  { label: "Messages", used: 8420, limit: 20000 },
  { label: "Comments", used: 1120, limit: 4000 },
  { label: "Posts", used: 176, limit: 500 },
  { label: "Storage", used: 2.1, limit: 10, unit: "GB" },
];
