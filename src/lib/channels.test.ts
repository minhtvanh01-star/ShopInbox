import { describe, expect, it } from "vitest";
import { channelHasCredentials } from "./channels";

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
