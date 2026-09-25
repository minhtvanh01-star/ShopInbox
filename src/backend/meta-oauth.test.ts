import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMetaOAuthUrl,
  fetchRecentMetaConversations,
  inboundMessagesFromMetaConversations,
  isOutsideMessagingWindowError,
  metaScopesForChannel,
  sendMetaMessage,
  subscribeMetaAppWebhook,
} from "@/backend/meta-oauth";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("metaScopesForChannel", () => {
  it("does not request deprecated Instagram scopes", () => {
    const facebook = metaScopesForChannel("facebook");
    const instagram = metaScopesForChannel("instagram");
    for (const scopes of [facebook, instagram]) {
      expect(scopes).toContain("pages_messaging");
      expect(scopes).not.toContain("instagram_basic");
      expect(scopes).not.toContain("instagram_manage_messages");
    }
  });
});

describe("buildMetaOAuthUrl", () => {
  it("puts channel scopes into the authorize URL", () => {
    const url = new URL(
      buildMetaOAuthUrl(
        {
          appId: "app-1",
          appSecret: "secret",
          redirectUri: "https://shopinbox.example.com/api/connect/meta/callback",
          webhookVerifyToken: "",
        },
        "state-1",
        "facebook",
      ),
    );
    expect(url.searchParams.get("scope")).toBe(metaScopesForChannel("facebook"));
    expect(url.searchParams.get("client_id")).toBe("app-1");
  });
});

describe("inboundMessagesFromMetaConversations", () => {
  it("bỏ tin của Page và giữ tin khách theo thứ tự cũ → mới", () => {
    const inbound = inboundMessagesFromMetaConversations(
      [
        {
          messages: {
            data: [
              {
                id: "m-new",
                message: "hello",
                created_time: "2026-08-15T09:08:00+0000",
                from: { id: "user-1", name: "Pham Vu Anh Minh" },
              },
              {
                id: "m-page",
                message: "shop reply",
                from: { id: "page-1", name: "Góc cây nhà Minh" },
              },
            ],
          },
        },
      ],
      ["page-1"],
    );

    expect(inbound).toEqual([
      {
        senderExternalId: "user-1",
        senderName: "Pham Vu Anh Minh",
        senderAvatarUrl: undefined,
        text: "hello",
        externalMessageId: "m-new",
        sentAt: new Date("2026-08-15T09:08:00+0000"),
      },
    ]);
  });

  it("lấy avatar từ participants khi có profile_pic", () => {
    const inbound = inboundMessagesFromMetaConversations(
      [
        {
          id: "c1",
          participants: {
            data: [
              { id: "user-1", name: "Minh", profile_pic: "https://cdn.example.com/u1.jpg" },
              { id: "page-1", name: "Shop" },
            ],
          },
          messages: {
            data: [
              {
                id: "m1",
                message: "hi",
                created_time: "2026-08-15T09:08:00+0000",
                from: { id: "user-1", name: "Minh" },
              },
            ],
          },
        },
      ],
      ["page-1"],
    );

    expect(inbound[0]).toMatchObject({
      senderExternalId: "user-1",
      senderAvatarUrl: "https://cdn.example.com/u1.jpg",
    });
  });
});

describe("subscribeMetaAppWebhook", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("không gọi Graph khi thiếu verify token", async () => {
    await expect(
      subscribeMetaAppWebhook(
        {
          appId: "app-1",
          appSecret: "secret",
          redirectUri: "https://example.com/callback",
          webhookVerifyToken: "",
        },
        "https://example.com/api/webhooks/meta",
      ),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("đăng ký page subscriptions với callback + verify token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await expect(
      subscribeMetaAppWebhook(
        {
          appId: "app-1",
          appSecret: "secret",
          redirectUri: "https://example.com/callback",
          webhookVerifyToken: "verify-me",
        },
        "https://shopinbox.example.com/api/webhooks/meta",
      ),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/app-1/subscriptions");
    expect(url).toContain("access_token=app-1%7Csecret");
    expect(init.method).toBe("POST");
    const pageBody = String(init.body);
    expect(pageBody).toContain("object=page");
    expect(pageBody).toContain("verify_token=verify-me");
    expect(pageBody).toContain(
      "callback_url=https%3A%2F%2Fshopinbox.example.com%2Fapi%2Fwebhooks%2Fmeta",
    );
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("object=instagram");
  });
});

describe("fetchRecentMetaConversations", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("lấy hội thoại Messenger của Page", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "t_1", messages: { data: [] } }] }),
    });

    await expect(fetchRecentMetaConversations("page-1", "token")).resolves.toEqual([
      { id: "t_1", messages: { data: [] } },
    ]);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/page-1/conversations");
    expect(url).toContain("platform=MESSENGER");
  });
});

describe("isOutsideMessagingWindowError", () => {
  it("nhận diện lỗi cửa sổ 24h", () => {
    expect(
      isOutsideMessagingWindowError(
        "(#10) This message is sent outside of allowed window.",
      ),
    ).toBe(true);
    expect(isOutsideMessagingWindowError("Invalid OAuth access token")).toBe(false);
  });

  it("nhận diện lỗi cửa sổ 24h tiếng Việt (locale Graph)", () => {
    expect(
      isOutsideMessagingWindowError(
        "(#10) Tin nhắn này được gửi ngoài khoảng thời gian cho phép. Tìm hiểu thêm về chính sách mới tại đây: https://developers.facebook.com/docs/messenger-platform/policy-overview",
      ),
    ).toBe(true);
  });
});

describe("sendMetaMessage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("RESPONSE ok → không retry HUMAN_AGENT", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message_id: "mid.ok" }),
    });

    await expect(
      sendMetaMessage({
        pageId: "page-1",
        accessToken: "token",
        recipientId: "psid-1",
        text: "hi",
      }),
    ).resolves.toEqual({ externalMessageId: "mid.ok" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.messaging_type).toBe("RESPONSE");
  });

  it("ngoài cửa sổ 24h → retry MESSAGE_TAG HUMAN_AGENT", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: "This message is sent outside of allowed window." },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message_id: "mid.human" }),
      });

    await expect(
      sendMetaMessage({
        pageId: "page-1",
        accessToken: "token",
        recipientId: "psid-1",
        text: "follow up",
        channel: "facebook",
      }),
    ).resolves.toEqual({ externalMessageId: "mid.human" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(retryBody.messaging_type).toBe("MESSAGE_TAG");
    expect(retryBody.tag).toBe("HUMAN_AGENT");
  });

  it("Instagram ngoài 24h → không retry HUMAN_AGENT", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "This message is sent outside of allowed window." },
      }),
    });

    await expect(
      sendMetaMessage({
        pageId: "page-1",
        accessToken: "token",
        recipientId: "igsid-1",
        text: "follow up",
        channel: "instagram",
      }),
    ).rejects.toThrow(/Instagram không hỗ trợ thẻ Human Agent/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lỗi #10 tiếng Việt → retry HUMAN_AGENT", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message:
              "(#10) Tin nhắn này được gửi ngoài khoảng thời gian cho phép. Tìm hiểu thêm về chính sách mới tại đây: https://developers.facebook.com/docs/messenger-platform/policy-overview",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message_id: "mid.human.vi" }),
      });

    await expect(
      sendMetaMessage({
        pageId: "page-1",
        accessToken: "token",
        recipientId: "psid-1",
        text: "follow up",
        channel: "facebook",
      }),
    ).resolves.toEqual({ externalMessageId: "mid.human.vi" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(retryBody.tag).toBe("HUMAN_AGENT");
  });
});
