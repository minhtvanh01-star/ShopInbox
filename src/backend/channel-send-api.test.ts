import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { sendMetaMessage } from "@/backend/meta-oauth";
import { sendZaloOaMessage, refreshZaloAccessToken } from "@/backend/zalo-oauth";

describe("sendMetaMessage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("trả về message_id khi Graph OK", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: "mid.123", recipient_id: "psid" }),
    });

    await expect(
      sendMetaMessage({
        pageId: "page-1",
        accessToken: "token",
        recipientId: "psid",
        text: "hi",
      }),
    ).resolves.toEqual({ externalMessageId: "mid.123" });
  });

  it("gửi attachment_id khi có ảnh", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: "mid.img", recipient_id: "psid" }),
    });

    await expect(
      sendMetaMessage({
        pageId: "page-1",
        accessToken: "token",
        recipientId: "psid",
        attachmentId: "att-1",
      }),
    ).resolves.toEqual({ externalMessageId: "mid.img" });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.message.attachment.payload.attachment_id).toBe("att-1");
  });
});

describe("sendZaloOaMessage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("trả về message_id khi Zalo OK", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ error: 0, data: { message_id: "z-1" } }),
    });

    await expect(
      sendZaloOaMessage({
        accessToken: "ztoken",
        recipientId: "uid",
        text: "xin chào",
      }),
    ).resolves.toEqual({ externalMessageId: "z-1" });
  });
});

describe("refreshZaloAccessToken", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("đổi refresh_token lấy access mới", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new",
        refresh_token: "r2",
        expires_in: "3600",
      }),
    });

    const result = await refreshZaloAccessToken(
      { appId: "a", appSecret: "s", redirectUri: "https://x" },
      "r1",
    );

    expect(result.accessToken).toBe("new");
    expect(result.refreshToken).toBe("r2");
    expect(result.expiresAt).toBeInstanceOf(Date);
  });
});
