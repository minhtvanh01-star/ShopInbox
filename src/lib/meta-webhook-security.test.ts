import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  sanitizeOAuthFlashMessage,
  verifyMetaWebhookSignature,
} from "./meta-webhook-security";

describe("verifyMetaWebhookSignature", () => {
  const secret = "app-secret";
  const body = '{"object":"page"}';

  it("chấp nhận chữ ký đúng", () => {
    const sig = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
    expect(verifyMetaWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("từ chối chữ ký sai / thiếu", () => {
    expect(verifyMetaWebhookSignature(body, "sha256=00", secret)).toBe(false);
    expect(verifyMetaWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(body, "sha256=abcd", "")).toBe(false);
  });
});

describe("sanitizeOAuthFlashMessage", () => {
  it("che access_token và cắt dài", () => {
    const msg = sanitizeOAuthFlashMessage(
      `fail access_token=EAAxxxx&x=${"a".repeat(200)}`,
      40,
    );
    expect(msg).not.toContain("EAAxxxx");
    expect(msg).toContain("access_token=***");
    expect(msg.length).toBeLessThanOrEqual(40);
  });
});
