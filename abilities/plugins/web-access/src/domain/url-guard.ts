const PRIVATE_V4 = [
  /^10\./u,
  /^127\./u,
  /^169\.254\./u,
  /^192\.168\./u,
  /^172\.(1[6-9]|2\d|3[01])\./u,
  /^0\./u
];

const PRIVATE_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp"];

/**
 * The agent can be talked into fetching an address by a page it just read, so
 * loopback and LAN targets stay off unless the user deliberately enables them.
 */
export function privateHostReason(hostname: string): string | null {
  const host = hostname.replace(/^\[|\]$/gu, "").replace(/\.$/u, "").toLowerCase();
  if (!host) return "empty host";
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") return "loopback address";
  if (host === "metadata.google.internal") return "cloud metadata address";
  if (PRIVATE_V4.some((pattern) => pattern.test(host))) return "private network address";
  if (host.includes(":")) {
    const first = host.split(":")[0] ?? "";
    if (first === "fe80" || first.startsWith("fc") || first.startsWith("fd")) return "private network address";
  }
  if (PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return "private network name";
  return null;
}

export interface ParsedTarget {
  url: URL;
}

export function parseHttpUrl(value: string): ParsedTarget {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`"${value}" is not a valid URL. Pass an absolute http(s) address.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Only http and https addresses can be read; got ${url.protocol}${url.host ? ` from ${url.host}` : ""}.`);
  }
  if (!url.hostname) throw new Error("The URL has no host.");
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not accepted; use a page that does not require them.");
  return { url };
}
