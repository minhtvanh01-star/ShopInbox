import { describe, expect, it } from "vitest";
import {
  isCloudflareExemptPath,
  isCloudflareProxiedRequest,
  shouldRequireCloudflare,
} from "./cloudflare";

describe("cloudflare gate", () => {
  it("only requires CF when opted in on production", () => {
    expect(shouldRequireCloudflare({ NODE_ENV: "production" })).toBe(false);
    expect(shouldRequireCloudflare({ NODE_ENV: "production", CLOUDFLARE_ONLY: "1" })).toBe(true);
    expect(shouldRequireCloudflare({ NODE_ENV: "development", CLOUDFLARE_ONLY: "1" })).toBe(false);
  });

  it("detects proxied requests and exempt paths", () => {
    expect(isCloudflareProxiedRequest((name) => (name === "cf-ray" ? "abc-SGN" : null))).toBe(true);
    expect(isCloudflareProxiedRequest(() => null)).toBe(false);
    expect(isCloudflareExemptPath("/api/health")).toBe(true);
    expect(isCloudflareExemptPath("/api/cron/backup")).toBe(true);
    expect(isCloudflareExemptPath("/api/webhooks/meta")).toBe(true);
    expect(isCloudflareExemptPath("/login")).toBe(false);
  });
});
