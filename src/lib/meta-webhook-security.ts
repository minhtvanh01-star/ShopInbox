import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Meta `X-Hub-Signature-256` (HMAC-SHA256 of raw body with App Secret).
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string,
): boolean {
  const secret = appSecret.trim();
  if (!secret || !signatureHeader) {
    return false;
  }

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    return false;
  }

  const providedHex = signatureHeader.slice(prefix.length).trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(providedHex) || providedHex.length !== 64) {
    return false;
  }

  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(providedHex, "hex"));
  } catch {
    return false;
  }
}

/** Rút gọn message OAuth đưa lên query string — tránh lộ token / chuỗi Graph dài. */
export function sanitizeOAuthFlashMessage(raw: string, maxLen = 160): string {
  const cleaned = raw
    .replace(/access_token=[^&\s]+/gi, "access_token=***")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=***")
    .replace(/E:\\[^\s]+/gi, "[path]")
    .replace(/\/(?:Users|home)\/[^\s]+/gi, "[path]")
    .trim();
  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLen - 1)}…`;
}
