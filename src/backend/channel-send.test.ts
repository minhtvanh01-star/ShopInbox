import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    customerIdentity: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/backend/meta-oauth", () => ({
  sendMetaMessage: vi.fn(),
}));

vi.mock("@/backend/zalo-oauth", () => ({
  sendZaloOaMessage: vi.fn(),
  refreshZaloAccessToken: vi.fn(),
}));

vi.mock("@/backend/oauth-config", () => ({
  getZaloOAuthConfig: vi.fn(() => ({
    appId: "zalo-app",
    appSecret: "zalo-secret",
    redirectUri: "https://example.com/callback",
  })),
}));

import { prisma } from "@/backend/prisma";
import { sendMetaMessage } from "@/backend/meta-oauth";
import { refreshZaloAccessToken, sendZaloOaMessage } from "@/backend/zalo-oauth";
import { dispatchOutboundMessage } from "@/backend/channel-send";

describe("dispatchOutboundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("web / chưa OAuth → local (chỉ DB)", async () => {
    await expect(
      dispatchOutboundMessage({
        shopId: "shop1",
        channel: "web",
        customerId: "cust1",
        text: "xin chào",
      }),
    ).resolves.toEqual({ mode: "local" });

    expect(prisma.channelAccount.findUnique).not.toHaveBeenCalled();
  });

  it("facebook ready + token → gọi Meta Send API", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-fb",
      channel: "facebook",
      status: "ready",
      accessToken: "page-token",
      refreshToken: null,
      expiresAt: null,
      pageId: "page-1",
      linkedPageId: null,
      oaId: null,
    } as never);
    vi.mocked(prisma.customerIdentity.findUnique).mockResolvedValue({
      externalId: "psid-1",
    } as never);
    vi.mocked(sendMetaMessage).mockResolvedValue({ externalMessageId: "mid.abc" });

    await expect(
      dispatchOutboundMessage({
        shopId: "shop1",
        channel: "facebook",
        customerId: "cust1",
        text: "Trả lời FB",
      }),
    ).resolves.toEqual({ mode: "remote", externalMessageId: "mid.abc" });

    expect(sendMetaMessage).toHaveBeenCalledWith({
      pageId: "page-1",
      accessToken: "page-token",
      recipientId: "psid-1",
      text: "Trả lời FB",
    });
  });

  it("instagram dùng linkedPageId khi gửi", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-ig",
      channel: "instagram",
      status: "ready",
      accessToken: "page-token",
      refreshToken: null,
      expiresAt: null,
      pageId: "ig-biz-1",
      linkedPageId: "fb-page-9",
      oaId: null,
    } as never);
    vi.mocked(prisma.customerIdentity.findUnique).mockResolvedValue({
      externalId: "igsid-1",
    } as never);
    vi.mocked(sendMetaMessage).mockResolvedValue({ externalMessageId: "mid.ig" });

    await dispatchOutboundMessage({
      shopId: "shop1",
      channel: "instagram",
      customerId: "cust1",
      text: "IG reply",
    });

    expect(sendMetaMessage).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "fb-page-9", recipientId: "igsid-1" }),
    );
  });

  it("Meta API lỗi → ném lỗi tiếng Việt, không local silent", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-fb",
      channel: "facebook",
      status: "ready",
      accessToken: "page-token",
      refreshToken: null,
      expiresAt: null,
      pageId: "page-1",
      linkedPageId: null,
      oaId: null,
    } as never);
    vi.mocked(prisma.customerIdentity.findUnique).mockResolvedValue({
      externalId: "psid-1",
    } as never);
    vi.mocked(sendMetaMessage).mockRejectedValue(new Error("#100 bad request"));

    await expect(
      dispatchOutboundMessage({
        shopId: "shop1",
        channel: "facebook",
        customerId: "cust1",
        text: "fail",
      }),
    ).rejects.toThrow(/Gửi tin Facebook thất bại/);
  });

  it("zalo refresh token khi gần hết hạn", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-zalo",
      channel: "zalo",
      status: "ready",
      accessToken: "old-token",
      refreshToken: "refresh-1",
      expiresAt: new Date(Date.now() + 60_000),
      pageId: null,
      linkedPageId: null,
      oaId: "oa-1",
    } as never);
    vi.mocked(prisma.customerIdentity.findUnique).mockResolvedValue({
      externalId: "zalo-user-1",
    } as never);
    vi.mocked(refreshZaloAccessToken).mockResolvedValue({
      accessToken: "new-token",
      refreshToken: "refresh-2",
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    vi.mocked(prisma.channelAccount.update).mockResolvedValue({} as never);
    vi.mocked(sendZaloOaMessage).mockResolvedValue({ externalMessageId: "zmsg-1" });

    await expect(
      dispatchOutboundMessage({
        shopId: "shop1",
        channel: "zalo",
        customerId: "cust1",
        text: "Zalo hi",
      }),
    ).resolves.toEqual({ mode: "remote", externalMessageId: "zmsg-1" });

    expect(refreshZaloAccessToken).toHaveBeenCalled();
    expect(sendZaloOaMessage).toHaveBeenCalledWith({
      accessToken: "new-token",
      recipientId: "zalo-user-1",
      text: "Zalo hi",
    });
  });

  it("facebook disconnected → local demo", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-fb",
      channel: "facebook",
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      pageId: null,
      linkedPageId: null,
      oaId: null,
    } as never);

    await expect(
      dispatchOutboundMessage({
        shopId: "shop1",
        channel: "facebook",
        customerId: "cust1",
        text: "demo",
      }),
    ).resolves.toEqual({ mode: "local" });

    expect(sendMetaMessage).not.toHaveBeenCalled();
  });
});
