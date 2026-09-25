import { describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "./client-ip";

describe("clientIpFromHeaders", () => {
  it("prefers Cloudflare connecting IP", () => {
    const headers = new Map([
      ["cf-connecting-ip", "203.0.113.9"],
      ["x-forwarded-for", "198.51.100.2, 172.16.0.1"],
      ["x-real-ip", "198.51.100.3"],
    ]);
    expect(clientIpFromHeaders((name) => headers.get(name))).toBe("203.0.113.9");
  });

  it("falls back to forwarded / real-ip", () => {
    expect(
      clientIpFromHeaders((name) => (name === "x-forwarded-for" ? "198.51.100.2, 10.0.0.1" : null)),
    ).toBe("198.51.100.2");
  });
});
