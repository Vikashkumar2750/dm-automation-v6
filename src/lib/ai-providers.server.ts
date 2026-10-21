/**
 * Secure multi-provider AI engine with automatic failover.
 *
 * SECURITY RULES (do not relax):
 *  - This file is server-only (`*.server.ts` is blocked from client bundles).
 *    API keys never reach the browser, never appear in a response body and are
 *    never logged.
 *  - Keys are read either from environment variables (Railway) or from the
 *    super-admin configuration, which is stored behind the service-role client
 *    and only ever returned to the UI in masked form.
 *  - Every prompt input is sanitised and truncated before it leaves this file,
 *    so a hostile comment cannot inject instructions or drain tokens.
 *
 * FAILOVER ORDER
 *  1. OpenRouter keys, in order (key 1 → key 2 → …) — moves on when a key is
 *     out of credits (402), rate limited (429), rejected (401/403) or errors.
 *  2. NVIDIA NIM
 *  3. OpenAI
 *  4. Lovable AI Gateway
 *  Nothing left → caller uses its own local fallback text.
 *
 * Nothing in this file touches the locked Instagram / Facebook DM engine.
 */

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export const AI_PROVIDERS_KEY = "__ai_providers";

const MAX_PROMPT_CHARS = 1200;
const MAX_OUTPUT_CHARS = 700;
const REQUEST_TIMEOUT_MS = 20_000;

export type AiProviderConfig = {
  enabled: boolean;
  openRouterKeys: string[];
  openRouterModel: string;
  nvidiaKey: string;
  nvidiaModel: string;
  openAiKey: string;
  openAiModel: string;
  useLovableFallback: boolean;
  maxCallsPerHour: number;
};

export const DEFAULT_AI_PROVIDERS: AiProviderConfig = {
  enabled: true,
  openRouterKeys: [],
  openRouterModel: "meta-llama/llama-3.3-70b-instruct",
  nvidiaKey: "",
  nvidiaModel: "meta/llama-3.3-70b-instruct",
  openAiKey: "",
  openAiModel: "gpt-4o-mini",
  useLovableFallback: true,
  maxCallsPerHour: 600,
};

export function mergeAiProviders(raw: unknown): AiProviderConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<AiProviderConfig>;
  const keys = Array.isArray(c.openRouterKeys)
    ? c.openRouterKeys.map((k) => String(k ?? "").trim()).filter(Boolean).slice(0, 10)
    : [];
  return {
    enabled: c.enabled !== false,
    openRouterKeys: keys,
    openRouterModel: (c.openRouterModel ?? "").trim() || DEFAULT_AI_PROVIDERS.openRouterModel,
    nvidiaKey: (c.nvidiaKey ?? "").trim(),
    nvidiaModel: (c.nvidiaModel ?? "").trim() || DEFAULT_AI_PROVIDERS.nvidiaModel,
    openAiKey: (c.openAiKey ?? "").trim(),
    openAiModel: (c.openAiModel ?? "").trim() || DEFAULT_AI_PROVIDERS.openAiModel,
    useLovableFallback: c.useLovableFallback !== false,
    maxCallsPerHour: clampInt(c.maxCallsPerHour, 1, 20_000, DEFAULT_AI_PROVIDERS.maxCallsPerHour),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Environment keys always win as a safe baseline; admin config adds to them. */
function envOpenRouterKeys(): string[] {
  const raw =
    process.env["OPENROUTER_API_KEYS"] ??
    process.env["OPENROUTER_API_KEY"] ??
    "";
  return raw
    .split(/[\s,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export async function readAiProviders(admin: AdminClient): Promise<AiProviderConfig> {
  let stored: unknown = {};
  try {
    const { data } = await admin
      .from("platform_settings")
      .select("feature_flags")
      .eq("id", true)
      .maybeSingle();
    const flags = (data?.feature_flags ?? {}) as Record<string, unknown>;
    stored = flags[AI_PROVIDERS_KEY] ?? {};
  } catch {
    stored = {};
  }
  const config = mergeAiProviders(stored);
  const merged = [...new Set([...config.openRouterKeys, ...envOpenRouterKeys()])];
  return {
    ...config,
    openRouterKeys: merged,
    nvidiaKey: config.nvidiaKey || (process.env["NVIDIA_API_KEY"] ?? "").trim(),
    openAiKey: config.openAiKey || (process.env["OPENAI_API_KEY"] ?? "").trim(),
  };
}

/** Never expose a key. The UI only ever sees a short tail plus a count. */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

export type AiProviderStatus = {
  enabled: boolean;
  openRouter: { count: number; masked: string[]; model: string; fromEnv: number };
  nvidia: { configured: boolean; masked: string; model: string };
  openAi: { configured: boolean; masked: string; model: string };
  useLovableFallback: boolean;
  lovableConfigured: boolean;
  maxCallsPerHour: number;
};

export function describeAiProviders(config: AiProviderConfig): AiProviderStatus {
  return {
    enabled: config.enabled,
    openRouter: {
      count: config.openRouterKeys.length,
      masked: config.openRouterKeys.map(maskKey),
      model: config.openRouterModel,
      fromEnv: envOpenRouterKeys().length,
    },
    nvidia: {
      configured: Boolean(config.nvidiaKey),
      masked: maskKey(config.nvidiaKey),
      model: config.nvidiaModel,
    },
    openAi: {
      configured: Boolean(config.openAiKey),
      masked: maskKey(config.openAiKey),
      model: config.openAiModel,
    },
    useLovableFallback: config.useLovableFallback,
    lovableConfigured: Boolean(process.env["LOVABLE_API_KEY"]),
    maxCallsPerHour: config.maxCallsPerHour,
  };
}

/* ------------------------------------------------------------------ *
 * Anti-abuse: in-process hourly budget so a comment flood or a bug
 * can never drain paid credits in a loop.
 * ------------------------------------------------------------------ */

const budget = new Map<string, { windowStart: number; used: number }>();

export function withinAiBudget(scope: string, maxCallsPerHour: number): boolean {
  const now = Date.now();
  const entry = budget.get(scope);
  if (!entry || now - entry.windowStart > 3_600_000) {
    budget.set(scope, { windowStart: now, used: 1 });
    return true;
  }
  if (entry.used >= maxCallsPerHour) return false;
  entry.used += 1;
  return true;
}

export function resetAiBudget() {
  budget.clear();
}

/**
 * Strip anything that looks like an instruction to the model, collapse
 * whitespace and hard-truncate. Protects against prompt injection and
 * oversized payloads sent to burn tokens.
 */
export function sanitisePromptInput(value: string, limit = 400): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/```+/g, " ")
    .replace(
      /\b(ignore|disregard|forget)\s+(all\s+|the\s+|your\s+|previous\s+|above\s+)*(instructions?|prompts?|rules?)\b/gi,
      " ",
    )
    .replace(/\b(system|assistant|developer)\s*:/gi, " ")
    .replace(/<\/?[a-z][^>]{0,80}>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanOutput(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/^\s*(assistant|reply)\s*:\s*/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.slice(0, MAX_OUTPUT_CHARS);
}

type Attempt = { provider: string; status: number | null; error: string };

export type AiResult = {
  text: string | null;
  provider: string | null;
  attempts: Attempt[];
};

async function chatCompletion(opts: {
  url: string;
  key: string;
  model: string;
  system: string;
  prompt: string;
  extraHeaders?: Record<string, string>;
  long?: boolean;
  maxTokens?: number;
}): Promise<{ text: string | null; status: number; detail?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.long ? 90_000 : REQUEST_TIMEOUT_MS);
  try {
    let maxTokens = opts.maxTokens ?? (opts.long ? 4000 : 220);
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(opts.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.key}`,
          ...(opts.extraHeaders ?? {}),
        },
        body: JSON.stringify({
          model: opts.model,
          temperature: 0.7,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.prompt },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // OpenRouter answers 402 when the balance can't cover max_tokens, and
        // says how many it can afford — retry once with that smaller budget.
        if (res.status === 402 && attempt === 0) {
          const afford = Number(body.match(/can only afford (\d+)/i)?.[1] ?? 0);
          const next = afford - 20;
          if (next >= 150 && next < maxTokens) {
            maxTokens = next;
            continue;
          }
        }
        let detail = "";
        try {
          const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
          detail = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? "";
        } catch {
          detail = body;
        }
        // Never echo anything key-shaped back to the UI.
        detail = detail.replace(/\b(sk|nvapi|re)[-_][A-Za-z0-9_-]{8,}/g, "[key]").replace(/\s+/g, " ").trim().slice(0, 200);
        return { text: null, status: res.status, detail };
      }
      const json = (await res.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = json.choices?.[0]?.message?.content;
      return { text: opts.long ? raw?.trim() || null : cleanOutput(raw), status: res.status };
    }
    return { text: null, status: 402 };
  } finally {
    clearTimeout(timer);
  }
}

async function lovableGateway(
  system: string,
  prompt: string,
  long = false,
): Promise<{ text: string | null; status: number }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { text: null, status: 401 };
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");
  const { createLovableAiGatewayRunIdFetch } = await import("@/lib/ai-gateway.server");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    prompt,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const out = await result.text;
  return { text: long ? out.trim() || null : cleanOutput(out), status: 200 };
}

function statusFrom(error: unknown): number | null {
  const value = error as { statusCode?: unknown; status?: unknown };
  for (const candidate of [value?.statusCode, value?.status]) {
    if (typeof candidate === "number") return candidate;
  }
  const match = (error instanceof Error ? error.message : "").match(
    /\b(400|401|402|403|404|429|5\d\d)\b/,
  );
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Run the prompt through the configured providers until one answers.
 * Any non-2xx (out of credits, rate limited, revoked key) moves to the next
 * provider instead of failing the automation.
 */
export async function generateWithFailover(input: {
  config: AiProviderConfig;
  system: string;
  prompt: string;
  scope?: string;
  /** Long-form mode for the dashboard assistant: keeps formatting and allows longer output. */
  long?: boolean;
  /** Optional overrides for long-form writing (e.g. full blog articles). */
  maxTokens?: number;
  inputLimit?: number;
}): Promise<AiResult> {
  const attempts: Attempt[] = [];
  const { config } = input;
  if (!config.enabled) {
    return { text: null, provider: null, attempts: [{ provider: "disabled", status: null, error: "AI replies are switched off" }] };
  }
  if (!withinAiBudget(input.scope ?? "global", config.maxCallsPerHour)) {
    return {
      text: null,
      provider: null,
      attempts: [{ provider: "budget", status: 429, error: "Hourly AI budget reached" }],
    };
  }

  const limit = input.inputLimit ?? (input.long ? 4000 : MAX_PROMPT_CHARS);
  const long = input.long === true;
  const system = input.system.slice(0, limit);
  const prompt = input.prompt.slice(0, limit);

  type Candidate = { name: string; run: () => Promise<{ text: string | null; status: number; detail?: string }> };
  const candidates: Candidate[] = [];

  config.openRouterKeys.forEach((key, index) => {
    candidates.push({
      name: `openrouter#${index + 1}`,
      run: () =>
        chatCompletion({
          url: "https://openrouter.ai/api/v1/chat/completions",
          key,
          model: config.openRouterModel,
          system,
          prompt,
          long,
          maxTokens: input.maxTokens,
          extraHeaders: { "X-Title": "AutoDM by Techaasvik" },
        }),
    });
  });
  if (config.nvidiaKey) {
    candidates.push({
      name: "nvidia",
      run: () =>
        chatCompletion({
          url: "https://integrate.api.nvidia.com/v1/chat/completions",
          key: config.nvidiaKey,
          model: config.nvidiaModel,
          system,
          prompt,
          long,
          maxTokens: input.maxTokens,
        }),
    });
  }
  if (config.openAiKey) {
    candidates.push({
      name: "openai",
      run: () =>
        chatCompletion({
          url: "https://api.openai.com/v1/chat/completions",
          key: config.openAiKey,
          model: config.openAiModel,
          system,
          prompt,
          long,
          maxTokens: input.maxTokens,
        }),
    });
  }
  if (config.useLovableFallback) {
    candidates.push({ name: "lovable", run: () => lovableGateway(system, prompt, long) });
  }

  for (const candidate of candidates) {
    try {
      const { text, status, detail } = await candidate.run();
      if (text) return { text, provider: candidate.name, attempts };
      const base = status === 402 ? "out of credits" : status === 429 ? "rate limited" : `no usable reply (${status})`;
      attempts.push({
        provider: candidate.name,
        status,
        error: detail ? `${base}: ${detail}` : base,
      });
    } catch (error) {
      attempts.push({
        provider: candidate.name,
        status: statusFrom(error),
        error: error instanceof Error ? error.message.slice(0, 160) : "request failed",
      });
    }
  }
  return { text: null, provider: null, attempts };
}
