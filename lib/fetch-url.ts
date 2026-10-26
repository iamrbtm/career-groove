import { lookup } from "node:dns/promises";

export class UnsafeUrlError extends Error {
  public readonly code = "UNSAFE_URL";
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
}

function ipv4RangePrivate([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192) {
    if (b === 0) return c === 0 || c === 2;
    if (b === 88) return c === 99;
    if (b === 51) return c === 100;
    if (b === 168) return true;
    return false;
  }
  if (a === 198 && ((b === 18 || b === 19) || (b === 51 && c === 100))) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return a >= 224;
}

const strictDotted = /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/;

function isGlobalUnicastIpv6(value: string): boolean {
  if (!/^[0-9a-f:]+$/.test(value)) return false;
  const head = value.split(":")[0];
  if (!head) return false;
  const bits = parseInt(head, 16);
  return Number.isFinite(bits) && (bits & 0xe000) === 0x2000;
}

export function isPrivateIp(ip: string): boolean {
  const value = ip.trim().toLowerCase().split("%")[0].replace(/^\[|\]$/g, "");
  if (!value) return true;
  if (value.includes(":")) {
    const embedded = value.match(/(?:^|:)(\d+(?:\.\d+){1,3})$/);
    if (embedded) {
      if (!strictDotted.test(embedded[1])) return true;
      const octets = embedded[1].split(".").map(Number);
      if (octets.some((o) => o > 255)) return true;
      return ipv4RangePrivate(octets);
    }
    return !isGlobalUnicastIpv6(value);
  }
  if (/^\d+(\.\d+)*$/.test(value)) {
    if (!strictDotted.test(value)) return true;
    const octets = value.split(".").map(Number);
    if (octets.some((o) => o > 255)) return true;
    return ipv4RangePrivate(octets);
  }
  return true;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

async function validateHost(parsed: URL): Promise<void> {
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const isIpLiteral = hostname.includes(":") || /^\d+(\.\d+)*$/.test(hostname);
  if (isIpLiteral) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError("Only public job posting URLs are supported.");
    }
    return;
  }
  const resolved = await lookup(hostname, { all: true });
  if (resolved.some((entry) => isPrivateIp(entry.address))) {
    throw new UnsafeUrlError("Only public job posting URLs are supported.");
  }
}

export async function safeFetchUrl(
  url: string,
  timeoutMs = 10000,
  options: SafeFetchOptions = {},
): Promise<{ status: number; text: string }> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new UnsafeUrlError("Invalid URL.");
  }
  let redirects = 0;
  while (true) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new UnsafeUrlError("Only http(s) URLs are supported.");
    }
    await validateHost(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: options.headers,
    });
    const location = response.headers.get("location");
    if (REDIRECT_STATUSES.has(response.status) && location) {
      if (++redirects > MAX_REDIRECTS) {
        throw new UnsafeUrlError("Too many redirects.");
      }
      try {
        current = new URL(location, current);
      } catch {
        throw new UnsafeUrlError("Invalid redirect target.");
      }
      await response.body?.cancel().catch(() => undefined);
      continue;
    }
    const text = await response.text();
    return { status: response.status, text };
  }
}
