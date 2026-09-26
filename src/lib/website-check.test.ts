import { describe, expect, it } from "vitest";
import {
  detectInstalledChat,
  formatWebsiteCheckMessage,
  isPrivateIpAddress,
  isSameWebsiteCheckHost,
  parseWebsiteCheckUrl,
} from "./website-check";

describe("parseWebsiteCheckUrl", () => {
  it("accepts a public https shop URL", () => {
    const parsed = parseWebsiteCheckUrl("cuahang.vn/home");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.host).toBe("cuahang.vn");
      expect(parsed.href).toMatch(/^https:\/\/cuahang\.vn\//);
    }
  });

  it("rejects localhost and credentials", () => {
    expect(parseWebsiteCheckUrl("http://localhost:3000").ok).toBe(false);
    expect(parseWebsiteCheckUrl("https://127.0.0.1").ok).toBe(false);
    expect(parseWebsiteCheckUrl("https://user:pass@shop.vn").ok).toBe(false);
    expect(parseWebsiteCheckUrl("").ok).toBe(false);
  });

  it("does not treat public hosts as private IPv6", () => {
    expect(parseWebsiteCheckUrl("https://fdshop.com").ok).toBe(true);
  });

  it("only follows redirects on the same host", () => {
    expect(isSameWebsiteCheckHost("shop.vn", "SHOP.VN")).toBe(true);
    expect(isSameWebsiteCheckHost("shop.vn", "evil.example")).toBe(false);
  });
});

describe("isPrivateIpAddress", () => {
  it("flags loopback and RFC1918", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("10.1.2.3")).toBe(true);
    expect(isPrivateIpAddress("192.168.0.8")).toBe(true);
    expect(isPrivateIpAddress("172.16.0.1")).toBe(true);
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false);
  });
});

describe("detectInstalledChat", () => {
  it("finds a matching ShopInbox snippet", () => {
    const html = `<script src="https://app.example/widget.js" data-key="siwk_abc" async></script>`;
    const found = detectInstalledChat(html, {
      scriptUrl: "https://app.example/widget.js",
      widgetKey: "siwk_abc",
    });
    expect(found.shopInbox).toBe(true);
    expect(found.matchedKey).toBe(true);
  });

  it("notices another chat vendor", () => {
    const found = detectInstalledChat(`<script src="https://embed.tawk.to/1"></script>`);
    expect(found.shopInbox).toBe(false);
    expect(found.otherChats).toContain("Tawk");
  });
});

describe("formatWebsiteCheckMessage", () => {
  it("explains a missing snippet", () => {
    expect(
      formatWebsiteCheckMessage({
        found: false,
        matchedKey: false,
        otherChats: [],
        checkedUrl: "https://shop.vn/",
      }),
    ).toMatch(/Chưa thấy snippet/);
  });
});
