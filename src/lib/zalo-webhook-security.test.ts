import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isZaloWebhookTimestampFresh,
  verifyAndParseZaloWebhook,
  verifyZaloWebhookSignature,
  zaloWebhookVerifyTokenMatches,
} from "./zalo-webhook-security";

function mac(appId: string, data: string, timestamp: string, secret: string) {
  return createHash("sha256").update(appId + data + timestamp + secret, "utf8").digest("hex");
}

describe("verifyZaloWebhookSignature", () => {
  const appId = "app-1";
  const secret = "oa-secret";
  const timestamp = "1700000000000";
  const rawBody = JSON.stringify({
    event_name: "user_send_text",
    oa_id: "oa-1",
    timestamp,
    sender: { id: "u1" },
    message: { text: "hi", msg_id: "m1" },
  });

  it("chấp nhận header khớp công thức appId+body+ts+secret", () => {
    const sig = `mac=${mac(appId, rawBody, timestamp, secret)}`;
    expect(
      verifyZaloWebhookSignature({
        rawBody,
        signatureHeader: sig,
        appId,
        appSecret: secret,
      }),
    ).toBe(true);
  });

  it("từ chối sai chữ ký / thiếu secret", () => {
    expect(
      verifyZaloWebhookSignature({
        rawBody,
        signatureHeader: `mac=${"ab".repeat(32)}`,
        appId,
        appSecret: secret,
      }),
    ).toBe(false);
    expect(
      verifyZaloWebhookSignature({
        rawBody,
        signatureHeader: `mac=${mac(appId, rawBody, timestamp, secret)}`,
        appId,
        appSecret: "",
      }),
    ).toBe(false);
  });
});

describe("verifyAndParseZaloWebhook", () => {
  const appId = "app-1";
  const secret = "oa-secret";
  const timestamp = String(Date.now());

  it("chỉ ingest data đã ký, bỏ field ngoài data", () => {
    const inner = { event_name: "user_send_text", oa_id: "oa-signed", sender: { id: "u1" }, message: { text: "hi" } };
    const data = JSON.stringify(inner);
    const rawBody = JSON.stringify({
      data,
      timestamp,
      event_name: "user_send_text",
      oa_id: "oa-unsigned",
      mac: mac(appId, data, timestamp, secret),
    });

    const parsed = verifyAndParseZaloWebhook({
      rawBody,
      signatureHeader: null,
      appId,
      appSecret: secret,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.event.oa_id).toBe("oa-signed");
      expect(parsed.event.oa_id).not.toBe("oa-unsigned");
    }
  });
});

describe("isZaloWebhookTimestampFresh", () => {
  it("chấp nhận timestamp trong cửa sổ, từ chối quá cũ", () => {
    const now = 1_700_000_000_000;
    expect(isZaloWebhookTimestampFresh(now, now)).toBe(true);
    expect(isZaloWebhookTimestampFresh(now - 16 * 60 * 1000, now)).toBe(false);
  });
});

describe("zaloWebhookVerifyTokenMatches", () => {
  it("so khớp token GET", () => {
    expect(zaloWebhookVerifyTokenMatches("abc", "abc")).toBe(true);
    expect(zaloWebhookVerifyTokenMatches("abc", "xyz")).toBe(false);
    expect(zaloWebhookVerifyTokenMatches("abc", "")).toBe(false);
  });
});
