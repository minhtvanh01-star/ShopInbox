import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/backend/oauth-config", () => ({
  getWebWidgetScriptUrl: () => "https://app.example/widget.js",
}));

import { lookup } from "node:dns/promises";
import { prisma } from "@/backend/prisma";
import { checkWebsiteWidgetInstall } from "@/backend/website-check";

describe("checkWebsiteWidgetInstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookup).mockResolvedValue([{ address: "1.2.3.4", family: 4 }] as never);
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      pageId: "https://shop.vn",
      webhookSecret: "siwk_abc",
    } as never);
  });

  it("reports a live ShopInbox snippet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
        text: async () => `<script src="https://app.example/widget.js" data-key="siwk_abc"></script>`,
      }),
    );

    const result = await checkWebsiteWidgetInstall({ shopId: "shop1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.found).toBe(true);
      expect(result.matchedKey).toBe(true);
    }
    vi.unstubAllGlobals();
  });

  it("refuses a hostname that resolves privately", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    const result = await checkWebsiteWidgetInstall({
      shopId: "shop1",
      url: "https://evil.example",
    });
    expect(result).toEqual({ ok: false, error: "Tên miền trỏ về địa chỉ nội bộ — bỏ qua." });
  });

  it("does not follow a redirect to another host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        headers: new Headers({ location: "https://evil.example/secret" }),
        body: null,
        text: async () => "",
      }),
    );

    const result = await checkWebsiteWidgetInstall({
      shopId: "shop1",
      url: "https://shop.vn",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/chuyển hướng|nội bộ/i);
    }
    vi.unstubAllGlobals();
  });
});
