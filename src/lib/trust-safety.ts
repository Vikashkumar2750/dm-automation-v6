// Phase H pure helpers (browser + server safe).

export type HealthInput = {
  status: string; // social account status
  platform: string;
  tokenExpiresAt: string | null;
  sent7d: number;
  failed7d: number;
  rateLimitErrors24h: number;
  webhookErrors24h: number;
  lastEventAt: string | null;
  now?: number;
};

export type HealthResult = { score: number; grade: "good" | "watch" | "risk"; reasons: string[] };

/** 0–100 health score per connected account; each problem subtracts points and adds a plain reason. */
export function computeHealthScore(i: HealthInput): HealthResult {
  const now = i.now ?? Date.now();
  let score = 100;
  const reasons: string[] = [];
  if (i.status !== "connected" && i.status !== "active") {
    score -= 50;
    reasons.push("Account is not connected — reconnect it.");
  }
  if (i.platform !== "youtube" && i.tokenExpiresAt) {
    const days = (new Date(i.tokenExpiresAt).getTime() - now) / 86_400_000;
    if (days < 0) { score -= 40; reasons.push("Access has expired."); }
    else if (days <= 7) { score -= 15; reasons.push(`Access expires in ${Math.max(0, Math.round(days))} days.`); }
  }
  const attempts = i.sent7d + i.failed7d;
  if (attempts >= 5) {
    const failRate = i.failed7d / attempts;
    if (failRate >= 0.3) { score -= 25; reasons.push(`${Math.round(failRate * 100)}% of messages failed this week.`); }
    else if (failRate >= 0.1) { score -= 10; reasons.push(`${Math.round(failRate * 100)}% of messages failed this week.`); }
  }
  if (i.rateLimitErrors24h > 0) {
    score -= Math.min(30, i.rateLimitErrors24h * 10);
    reasons.push(`Meta slowed you down ${i.rateLimitErrors24h} time(s) in 24h.`);
  }
  if (i.webhookErrors24h >= 3) { score -= 10; reasons.push("Some incoming events failed to process."); }
  if (i.platform !== "youtube" && i.lastEventAt && now - new Date(i.lastEventAt).getTime() > 7 * 86_400_000) {
    score -= 5;
    reasons.push("No events received for over 7 days.");
  }
  score = Math.max(0, Math.min(100, score));
  return { score, grade: score >= 80 ? "good" : score >= 50 ? "watch" : "risk", reasons };
}

const RATE_LIMIT_RE = /(#(4|17|32|613)\b|rate.?limit|too many (calls|requests)|request limit|limit reached|code["':\s]+(4|17|32|613)\b)/i;
/** True when a stored failure reason looks like a Meta rate-limit response. */
export function isRateLimitError(detail: string | null | undefined): boolean {
  return !!detail && RATE_LIMIT_RE.test(detail);
}

export type RateRisk = { level: "ok" | "watch" | "slow_down"; projectedHour: number; message: string };

/** Predicts send pace from the last 10 minutes and recent Meta rate-limit signals. */
export function predictRateRisk(i: { sentLast10m: number; sentLastHour: number; hourlyLimit: number; rateLimitErrors15m: number }): RateRisk {
  const projectedHour = Math.max(i.sentLastHour, i.sentLast10m * 6);
  if (i.rateLimitErrors15m >= 3)
    return { level: "slow_down", projectedHour, message: "Meta is rejecting messages for speed. Sending pauses for 15 minutes to protect the account." };
  if (i.rateLimitErrors15m > 0 || projectedHour >= i.hourlyLimit * 0.8)
    return { level: "watch", projectedHour, message: `Sending fast: about ${projectedHour}/hour vs your limit ${i.hourlyLimit}.` };
  return { level: "ok", projectedHour, message: "Sending pace is safe." };
}

export const GUARD_PAUSE_MINUTES = 15;

export type PolicyIssue = { severity: "block" | "warn"; rule: string; message: string };

const CHECKS: { re: RegExp; severity: "block" | "warn"; rule: string; message: string }[] = [
  { re: /\b(password|otp|one[- ]time code|pin code|cvv|card number|login code)\b/i, severity: "block", rule: "credentials", message: "Never ask people for passwords, OTPs or card details — Meta bans this." },
  { re: /\b(guaranteed|100%) (income|returns|profit|earning)s?\b|\bdouble your money\b/i, severity: "block", rule: "misleading_claims", message: "Guaranteed money claims break Meta's misleading-content rules." },
  { re: /\b(casino|betting|bet now|escort|adult content|nudes|buy followers|buy likes)\b/i, severity: "block", rule: "restricted_content", message: "Restricted products/services are not allowed in automated messages." },
  { re: /\b(bit\.ly|tinyurl\.com|t\.co|cutt\.ly|shorturl\.at|rb\.gy)\//i, severity: "warn", rule: "link_shortener", message: "Short links often get flagged as spam — use the full link." },
  { re: /\b(like|share|tag \d+ friends?)\b.*\b(to win|for a chance|giveaway)\b/i, severity: "warn", rule: "engagement_bait", message: "\"Like/share/tag to win\" can count as engagement bait." },
];

/** Checks automated message text against common Meta messaging policy problems. */
export function checkPolicy(texts: (string | null | undefined)[]): PolicyIssue[] {
  const out: PolicyIssue[] = [];
  const seen = new Set<string>();
  const add = (x: PolicyIssue) => { if (!seen.has(x.rule)) { seen.add(x.rule); out.push(x); } };
  for (const raw of texts) {
    const t = (raw ?? "").trim();
    if (!t) continue;
    for (const c of CHECKS) if (c.re.test(t)) add({ severity: c.severity, rule: c.rule, message: c.message });
    const letters = t.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 20 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7)
      add({ severity: "warn", rule: "all_caps", message: "Mostly CAPITAL letters looks like spam." });
    if (t.length > 1000) add({ severity: "warn", rule: "too_long", message: "Messages over 1000 characters may be cut off." });
    if ((t.match(/https?:\/\//g) ?? []).length > 3) add({ severity: "warn", rule: "many_links", message: "More than 3 links in one message looks spammy." });
  }
  return out;
}

export function hasBlockingIssue(issues: PolicyIssue[]): boolean {
  return issues.some((i) => i.severity === "block");
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  automation_rules: "Automation",
  automation_settings: "Safety settings",
  team_settings: "Team settings",
  organization_members: "Team member",
  organization_invitations: "Invitation",
  social_accounts: "Connected account",
  api_keys: "API key",
  outgoing_webhooks: "Outgoing webhook",
  reply_approvals: "Reply approval",
  client_invoices: "Client invoice",
  broadcasts: "Broadcast",
  revenue_products: "Product",
  revenue_settings: "Revenue settings",
  payment_credentials: "Payment keys",
  coupon_campaigns: "Coupon campaign",
  delivery_pages: "Delivery page",
  nudge_settings: "Nudge settings",
  crm_sync_settings: "CRM sync",
  conversation_assignments: "Chat assignment",
  trust_settings: "Trust & safety settings",
};
