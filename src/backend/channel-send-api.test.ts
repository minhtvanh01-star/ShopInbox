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

  it("ném lỗi khi Graph trả error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid OAuth access token" } }),
    });

    await expect(
      sendMetaMessage({
        pageId: "page-1",
        accessToken: "bad",
        recipientId: "psid",
        text: "hi",
      }),
    ).rejects.toThrow("Invalid OAuth access token");
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
