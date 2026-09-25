import { createHash, timingSafeEqual } from "node:crypto";

function normalizeMac(value: string) {
  return value
    .trim()
    .replace(/^mac=/i, "")
    .toLowerCase();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqualHex(left: string, right: string) {
  if (left.length !== right.length || !/^[0-9a-f]+$/.test(left) || !/^[0-9a-f]+$/.test(right)) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  } catch {
    return false;
  }
}

function macOf(appId: string, data: string, timestamp: string, secret: string) {
  return sha256Hex(appId + data + timestamp + secret);
}

/**
 * Zalo OA: mac = sha256(appId + data + timestamp + secretKey).
 * @see https://docs.zaloplatforms.com/docs/OA/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
 */
export function verifyZaloWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  appId: string;
  appSecret: string;
  timestamp?: string | number | null;
}): boolean {
  const appId = input.appId.trim();
  const secret = input.appSecret.trim();
  if (!appId || !secret) {
    return false;
  }

  type ZaloWebhookBody = {
    data?: unknown;
    timestamp?: string | number;
    time?: string | number;
    mac?: string;
  };
  let parsed: ZaloWebhookBody | null = null;
  try {
    parsed = JSON.parse(input.rawBody) as ZaloWebhookBody;
  } catch {
    parsed = null;
  }

  const providedRaw = input.signatureHeader || (parsed && typeof parsed.mac === "string" ? parsed.mac : "");
  const provided = providedRaw ? normalizeMac(providedRaw) : "";
  if (!provided || provided.length !== 64) {
    return false;
  }

  const timestamp = String(input.timestamp ?? parsed?.timestamp ?? parsed?.time ?? "").trim();
  const candidates = [macOf(appId, input.rawBody, timestamp, secret)];
  if (parsed?.data !== undefined) {
    candidates.push(macOf(appId, JSON.stringify(parsed.data), timestamp, secret));
  }

  return candidates.some((expected) => safeEqualHex(expected, provided));
}

export const ZALO_WEBHOOK_MAX_SKEW_MS = 15 * 60 * 1000;

export function parseZaloWebhookTimestamp(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
    }
  }
  return null;
}

export function isZaloWebhookTimestampFresh(
  timestamp: string | number | null | undefined,
  now = Date.now(),
  windowMs = ZALO_WEBHOOK_MAX_SKEW_MS,
) {
  const ms = parseZaloWebhookTimestamp(timestamp);
  if (ms === null) return false;
  return Math.abs(now - ms) <= windowMs;
}

export type VerifiedZaloWebhook =
  | { ok: false }
  | { ok: true; event: Record<string, unknown>; timestamp?: string | number };

/**
 * Xác minh MAC rồi chỉ trả payload đã được ký.
 * Nếu có `data`, chỉ chấp nhận MAC trên `data` và ingest object đó.
 */
export function verifyAndParseZaloWebhook(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  appId: string;
  appSecret: string;
  timestamp?: string | number | null;
}): VerifiedZaloWebhook {
  const appId = input.appId.trim();
  const secret = input.appSecret.trim();
  if (!appId || !secret) return { ok: false };

  type ParsedBody = {
    data?: unknown;
    timestamp?: string | number;
    time?: string | number;
    mac?: string;
  };
  let parsed: ParsedBody;
  try {
    parsed = JSON.parse(input.rawBody) as ParsedBody;
  } catch {
    return { ok: false };
  }

  const providedRaw = input.signatureHeader || (typeof parsed.mac === "string" ? parsed.mac : "");
  const provided = providedRaw ? normalizeMac(providedRaw) : "";
  if (!provided || provided.length !== 64) return { ok: false };

  const timestamp = String(input.timestamp ?? parsed.timestamp ?? parsed.time ?? "").trim();

  if (parsed.data !== undefined) {
    const dataString = typeof parsed.data === "string" ? parsed.data : JSON.stringify(parsed.data);
    if (!safeEqualHex(macOf(appId, dataString, timestamp, secret), provided)) {
      return { ok: false };
    }
    let event: Record<string, unknown>;
    if (typeof parsed.data === "string") {
      try {
        const inner = JSON.parse(parsed.data) as unknown;
        if (!inner || typeof inner !== "object") return { ok: false };
        event = inner as Record<string, unknown>;
      } catch {
        return { ok: false };
      }
    } else if (parsed.data && typeof parsed.data === "object") {
      event = parsed.data as Record<string, unknown>;
    } else {
      return { ok: false };
    }
    return { ok: true, event, timestamp: parsed.timestamp ?? parsed.time };
  }

  if (!safeEqualHex(macOf(appId, input.rawBody, timestamp, secret), provided)) {
    return { ok: false };
  }
  return {
    ok: true,
    event: parsed as Record<string, unknown>,
    timestamp: parsed.timestamp ?? parsed.time,
  };
}

export function zaloWebhookVerifyTokenMatches(
  provided: string | null | undefined,
  expected: string | null | undefined,
) {
  const left = provided?.trim() ?? "";
  const right = expected?.trim() ?? "";
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
