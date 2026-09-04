import { record, textField, type AccountQuota, type JsonRecord, type ProxyAccount, type QuotaGroup, type QuotaWindow } from "./proxy-client";

/**
 * Reads a credential's remaining quota from the provider that issued it.
 *
 * The gateway only records limits it happened to see on a response, so a
 * freshly authorized account reports nothing until it has served traffic. The
 * providers all expose the figures directly, and the gateway can already make a
 * call on a credential's behalf — `/v0/management/api-call` substitutes the
 * stored token for the `$TOKEN$` placeholder — so asking outright is both
 * possible and the only way to answer "how much is left" before first use.
 *
 * The token never reaches this plugin: it names a credential, the gateway signs
 * the request. Each provider is described once, below, and anything not
 * described simply has no probe.
 */

type ApiCall = {
  method: "GET" | "POST";
  url: string;
  header: Record<string, string>;
  data?: string;
};

type ProviderProbe = {
  /** Candidate endpoints, tried in order until one answers. */
  calls(account: ProxyAccount): ApiCall[];
  parse(payload: unknown): AccountQuota | undefined;
};

const TOKEN = "Bearer $TOKEN$";

/** Client identity the provider expects; a generic agent gets rejected. */
const CODEX_AGENT = "codex-tui/0.149.1 (Mac OS 26.5.2; arm64) iTerm.app/3.6.11 (codex-tui; 0.149.1)";
const ANTIGRAVITY_AGENT = "antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)";

function number(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
}

/** OpenAI reports one window per pool, in seconds and percent used. */
function codexWindow(value: unknown): QuotaWindow | undefined {
  const entry = record(value);
  const used = number(entry?.used_percent);
  if (entry === undefined || used === undefined) return undefined;
  const seconds = number(entry.limit_window_seconds);
  const resetAt = number(entry.reset_at);
  const resetInSeconds = number(entry.reset_after_seconds);
  return {
    remainingPercent: Math.max(0, Math.min(100, 100 - used)),
    ...(seconds === undefined ? {} : { windowMinutes: Math.round(seconds / 60) }),
    ...(resetAt === undefined ? {} : { resetAt: new Date(resetAt * 1000).toISOString() }),
    ...(resetInSeconds === undefined ? {} : { resetInSeconds })
  };
}

const CODEX: ProviderProbe = {
  calls: () => [{
    method: "GET",
    url: "https://chatgpt.com/backend-api/wham/usage",
    header: { Authorization: TOKEN, "User-Agent": CODEX_AGENT }
  }],
  parse: (payload) => {
    const body = record(payload);
    if (!body) return undefined;
    const limits = record(body.rate_limit);
    const windows = [codexWindow(limits?.primary_window), codexWindow(limits?.secondary_window)]
      .filter((window): window is QuotaWindow => window !== undefined);
    const credits = record(body.credits);
    const balance = number(credits?.balance);
    const resetCredits = number(record(body.rate_limit_reset_credits)?.available_count);
    const plan = textField(body, "plan_type");
    if (windows.length === 0 && !plan && !credits) return undefined;
    return {
      windows,
      ...(plan ? { plan } : {}),
      ...(credits ? { credits: { unlimited: credits.unlimited === true, ...(balance === undefined ? {} : { balance }) } } : {}),
      ...(resetCredits === undefined ? {} : { resetCredits })
    };
  }
};

/** Google meters model families separately and reports what is left, as a fraction. */
const ANTIGRAVITY: ProviderProbe = {
  calls: (account) => {
    if (!account.projectId) return [];
    const data = JSON.stringify({ project: account.projectId });
    const header = { Authorization: TOKEN, "Content-Type": "application/json", "User-Agent": ANTIGRAVITY_AGENT };
    return [
      "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
      "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary",
      "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary"
    ].map((url) => ({ method: "POST" as const, url, header, data }));
  },
  parse: (payload) => {
    const raw = record(payload)?.groups;
    if (!Array.isArray(raw)) return undefined;
    const groups: QuotaGroup[] = [];
    for (const item of raw) {
      const entry = record(item);
      const buckets = Array.isArray(entry?.buckets) ? entry.buckets : [];
      const windows: QuotaWindow[] = [];
      for (const bucket of buckets) {
        const value = record(bucket);
        const fraction = number(value?.remaining_fraction ?? value?.remainingFraction);
        if (value === undefined || fraction === undefined) continue;
        const window = textField(value, "window");
        const resetTime = textField(value, "resetTime", "reset_time");
        const label = textField(value, "displayName", "display_name");
        windows.push({
          remainingPercent: Math.max(0, Math.min(100, fraction * 100)),
          ...(label ? { label } : {}),
          ...(window === "5h" ? { windowMinutes: 300 } : window === "weekly" ? { windowMinutes: 10_080 } : {}),
          ...(resetTime ? { resetAt: resetTime } : {})
        });
      }
      if (windows.length === 0) continue;
      windows.sort((left, right) => (left.windowMinutes ?? Infinity) - (right.windowMinutes ?? Infinity));
      const name = textField(entry, "displayName", "display_name");
      const description = textField(entry, "description");
      groups.push({ windows, ...(name ? { name } : {}), ...(description ? { description } : {}) });
    }
    return groups.length === 0 ? undefined : { windows: [], groups };
  }
};

const PROBES: Record<string, ProviderProbe> = {
  codex: CODEX,
  antigravity: ANTIGRAVITY
};

export function hasQuotaProbe(account: ProxyAccount): boolean {
  const probe = PROBES[account.provider.trim().toLowerCase()];
  return probe !== undefined && probe.calls(account).length > 0;
}

type ApiCallResponse = { status_code?: number; body?: unknown; bodyText?: string };

/**
 * Asks the provider for this credential's remaining quota.
 *
 * Returns `undefined` when the provider is not described here or answers with
 * nothing usable; a transport failure throws, so the surface can say the probe
 * failed rather than quietly showing a card with no limits.
 */
export async function probeAccountQuota(
  serviceRequest: <T>(path: string, options: { method?: "POST"; credentialId: string; body?: unknown }) => Promise<T>,
  managerCredential: string,
  account: ProxyAccount
): Promise<AccountQuota | undefined> {
  const probe = PROBES[account.provider.trim().toLowerCase()];
  if (!probe || !account.authIndex) return undefined;
  let lastError: unknown;
  for (const call of probe.calls(account)) {
    let response: ApiCallResponse | undefined;
    try {
      response = await serviceRequest<ApiCallResponse>("/v0/management/api-call", {
        method: "POST",
        credentialId: managerCredential,
        body: {
          auth_index: account.authIndex,
          method: call.method,
          url: call.url,
          header: call.header,
          ...(call.data === undefined ? {} : { data: call.data })
        }
      });
    } catch (reason) {
      lastError = reason;
      continue;
    }
    const status = response?.status_code ?? 0;
    if (status < 200 || status >= 300) {
      // A provider that answers 403/404 on one host may serve another.
      lastError = new Error(`HTTP ${status}`);
      continue;
    }
    const parsed = probe.parse(readBody(response));
    if (parsed) return parsed;
  }
  if (lastError) throw lastError;
  return undefined;
}

function readBody(response: ApiCallResponse): JsonRecord | undefined {
  if (record(response.body)) return record(response.body);
  if (typeof response.bodyText === "string") {
    try {
      return record(JSON.parse(response.bodyText));
    } catch {
      return undefined;
    }
  }
  return undefined;
}
