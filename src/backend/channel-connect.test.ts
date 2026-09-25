import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET ??= "shopinbox-test-session-secret";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/backend/meta-oauth", () => ({
  subscribeMetaPageWebhook: vi.fn(),
  subscribeMetaAppWebhook: vi.fn(),
  fetchRecentMetaConversations: vi.fn(),
}));

vi.mock("@/backend/message-sync", () => ({
  ingestRecentMetaMessages: vi.fn(),
}));

vi.mock("@/backend/oauth-config", () => ({
  getMetaOAuthConfig: vi.fn(() => ({
    appId: "app-1",
    appSecret: "secret",
    redirectUri: "https://example.com/callback",
    webhookVerifyToken: "verify",
  })),
  getMetaWebhookUrl: vi.fn(() => "https://example.com/api/webhooks/meta"),
}));

import { prisma } from "@/backend/prisma";
import {
  fetchRecentMetaConversations,
  subscribeMetaAppWebhook,
  subscribeMetaPageWebhook,
} from "@/backend/meta-oauth";
import { ingestRecentMetaMessages } from "@/backend/message-sync";
import { markChannelConnecting, disconnectChannel, syncConnectedMetaInbox, saveOAuthConnection } from "@/backend/channel-connect";

describe("markChannelConnecting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates existing channel account to connecting", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-facebook",
    } as never);
    vi.mocked(prisma.channelAccount.update).mockResolvedValue({} as never);

    await expect(markChannelConnecting("shop1", "facebook")).resolves.toBe("ch-facebook");

    expect(prisma.channelAccount.update).toHaveBeenCalledWith({
      where: { id: "ch-facebook" },
      data: {
        status: "connecting",
        note: "Đang chờ hoàn tất OAuth...",
      },
    });
    expect(prisma.channelAccount.create).not.toHaveBeenCalled();
  });

  it("creates draft channel account when shop has no row yet", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.channelAccount.create).mockResolvedValue({
      id: "ch-facebook-new",
    } as never);

    await expect(markChannelConnecting("shop1", "facebook")).resolves.toBe("ch-facebook-new");

    expect(prisma.channelAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shopId: "shop1",
        channel: "facebook",
        name: "Facebook Messenger",
        status: "connecting",
        note: "Đang chờ hoàn tất OAuth...",
      }),
    });
  });
});

describe("disconnectChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chỉ ngắt OAuth — không xóa hội thoại/tin (Inbox ẩn theo status ready)", async () => {
    vi.mocked(prisma.channelAccount.update).mockResolvedValue({} as never);

    await disconnectChannel("shop1", "facebook");

    expect(prisma.channelAccount.update).toHaveBeenCalledWith({
      where: { shopId_channel: { shopId: "shop1", channel: "facebook" } },
      data: expect.objectContaining({
        status: "disconnected",
        accessToken: null,
        note: expect.stringContaining("ẩn khỏi Inbox"),
      }),
    });
    expect(prisma.channelAccount.update).toHaveBeenCalledTimes(1);
  });
});

describe("syncConnectedMetaInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("đăng ký webhook rồi kéo tin khách vào Inbox", async () => {
    vi.mocked(prisma.channelAccount.findUniqueOrThrow).mockResolvedValue({
      id: "ch-facebook",
      status: "ready",
      accessToken: "page-token",
      pageId: "page-1",
      linkedPageId: "page-1",
      displayName: "Góc cây nhà Minh",
      name: "Facebook Messenger",
    } as never);
    vi.mocked(subscribeMetaAppWebhook).mockResolvedValue(true);
    vi.mocked(subscribeMetaPageWebhook).mockResolvedValue(true);
    vi.mocked(fetchRecentMetaConversations).mockResolvedValue([{ id: "t_1" }]);
    vi.mocked(ingestRecentMetaMessages).mockResolvedValue(2);
    vi.mocked(prisma.channelAccount.update).mockResolvedValue({} as never);

    await expect(syncConnectedMetaInbox("shop1", "facebook")).resolves.toEqual({
      ingested: 2,
      webhookNote: " Webhook app đã được đăng ký tự động. Webhook page đã được đăng ký tự động.",
    });

    expect(fetchRecentMetaConversations).toHaveBeenCalledWith("page-1", "page-token", {
      platform: "MESSENGER",
    });
    expect(ingestRecentMetaMessages).toHaveBeenCalledWith({
      channel: "facebook",
      externalAccountId: "page-1",
      pageIdsToSkip: ["page-1", "page-1"],
      conversations: [{ id: "t_1" }],
    });
    expect(prisma.channelAccount.update).toHaveBeenCalledWith({
      where: { id: "ch-facebook" },
      data: {
        note: expect.stringContaining("Đã kéo 2 tin nhắn gần đây vào Inbox."),
      },
    });
  });
});

describe("saveOAuthConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("vẫn giữ kênh ready và ghi note khi đồng bộ Inbox lỗi", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelAccount.findUniqueOrThrow)
      .mockResolvedValueOnce({
        id: "ch-facebook",
        pageId: null,
        linkedPageId: null,
        oaId: null,
      } as never)
      .mockResolvedValue({
        id: "ch-facebook",
        status: "ready",
        accessToken: "page-token",
        pageId: "page-1",
        linkedPageId: "page-1",
        displayName: "Fanpage Test",
        name: "Facebook Messenger",
      } as never);
    vi.mocked(prisma.channelAccount.update).mockResolvedValue({} as never);
    vi.mocked(subscribeMetaAppWebhook).mockResolvedValue(true);
    vi.mocked(subscribeMetaPageWebhook).mockResolvedValue(true);
    vi.mocked(fetchRecentMetaConversations).mockRejectedValue(new Error("Graph timeout"));

    await saveOAuthConnection({
      shopId: "shop1",
      channel: "facebook",
      displayName: "Fanpage Test",
      accessToken: "page-token",
      pageId: "page-1",
      linkedPageId: "page-1",
    });

    const notes = vi
      .mocked(prisma.channelAccount.update)
      .mock.calls.map((call) => (call[0] as { data?: { note?: string } }).data?.note)
      .filter(Boolean);
    expect(notes.some((note) => note?.includes("Đồng bộ Inbox lỗi") && note.includes("Graph timeout"))).toBe(
      true,
    );
  });
});
