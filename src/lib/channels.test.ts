import { describe, expect, it } from "vitest";
import { channelHasCredentials, CONNECT_PLATFORMS, PARTNER_CHANNEL_READY } from "./channels";

describe("channelHasCredentials", () => {
  it("accepts OAuth token as connected", () => {
    expect(
      channelHasCredentials("facebook", {
        accessToken: "token",
        pageId: "123",
        displayName: "My Page",
      }),
    ).toBe(true);
  });

  it("does not mark Meta ready from App ID/Secret alone", () => {
    expect(
      channelHasCredentials("facebook", {
        appId: "1",
        appSecret: "s",
        pageId: "p",
        webhookSecret: "w",
      }),
    ).toBe(false);

    expect(
      channelHasCredentials("facebook", {
        appId: "1",
        pageId: "p",
      }),
    ).toBe(false);
  });

  it("requires token + oaId (or displayName) for zalo", () => {
    expect(
      channelHasCredentials("zalo", {
        appId: "1",
        appSecret: "s",
        oaId: "oa",
        webhookSecret: "w",
      }),
    ).toBe(false);

    expect(
      channelHasCredentials("zalo", {
        accessToken: "token",
        oaId: "oa",
      }),
    ).toBe(true);
  });

  it("requires domain for web", () => {
    expect(channelHasCredentials("web", { pageId: "https://shop.vn" })).toBe(true);
    expect(channelHasCredentials("web", {})).toBe(false);
  });
});

describe("partner channel catalog", () => {
  it("opens Shopify Partner OAuth separately from the web widget", () => {
    const web = CONNECT_PLATFORMS.find((item) => item.id === "web");
    const shopify = CONNECT_PLATFORMS.find((item) => item.id === "shopify");
    expect(web?.channel).toBe("web");
    expect(web?.availability).toBe("available");
    expect(shopify?.channel).toBe("shopify");
    expect(shopify?.oauth).toBe(true);
    expect(shopify?.availability).toBe("available");
    expect(shopify?.fields.some((field) => field.key === "pageId")).toBe(true);
    expect(PARTNER_CHANNEL_READY.shopifyInbox).toBe(true);
  });

  it("requires token and shop domain for shopify", () => {
    expect(channelHasCredentials("shopify", { accessToken: "tok", pageId: "a.myshopify.com" })).toBe(
      true,
    );
    expect(channelHasCredentials("shopify", { pageId: "a.myshopify.com" })).toBe(false);
  });

  it("keeps WhatsApp and TikTok gated without OAuth", () => {
    const whatsapp = CONNECT_PLATFORMS.find((item) => item.id === "whatsapp");
    const tiktok = CONNECT_PLATFORMS.find((item) => item.id === "tiktok");
    expect(whatsapp?.channel).toBeUndefined();
    expect(whatsapp?.oauth).toBeFalsy();
    expect(whatsapp?.availability).toBe("beta");
    expect(whatsapp?.fields).toEqual([]);
    expect(tiktok?.channel).toBeUndefined();
    expect(tiktok?.oauth).toBeFalsy();
    expect(tiktok?.availability).toBe("coming");
    expect(tiktok?.fields).toEqual([]);
    expect(PARTNER_CHANNEL_READY.whatsappCloud).toBe(false);
    expect(PARTNER_CHANNEL_READY.tiktokMessaging).toBe(false);
  });
});
