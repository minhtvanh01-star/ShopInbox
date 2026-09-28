import { describe, expect, it } from "vitest";
import {
  formatOAuthFlashError,
  formatOAuthFlashSuccess,
  formatOAuthFlashWarning,
  hintFromMetaGraphMessage,
  metaCallbackErrorCode,
} from "./oauth-flash";

describe("hintFromMetaGraphMessage", () => {
  it("nhận Redirect URI", () => {
    expect(hintFromMetaGraphMessage("Invalid redirect_uri")).toMatch(/quản trị/i);
  });

  it("nhận lỗi miền tiếng Việt", () => {
    expect(
      hintFromMetaGraphMessage("Miền của URL này không được đưa vào miền của ứng dụng"),
    ).toMatch(/tên miền/i);
  });

  it("trả null khi không khớp", () => {
    expect(hintFromMetaGraphMessage("something else")).toBeNull();
  });
});

describe("metaCallbackErrorCode", () => {
  it("nhận màn Facebook «Ứng dụng không hoạt động»", () => {
    expect(
      metaCallbackErrorCode({
        error: "access_denied",
        errorDescription: "Ứng dụng này hiện không thể truy cập được",
      }),
    ).toBe("meta_app_unavailable");
    expect(metaCallbackErrorCode({ error: "access_denied" })).toBe("meta_denied");
    expect(formatOAuthFlashError("meta_app_unavailable").title).toMatch(/Tester/i);
  });
});

describe("formatOAuthFlashError", () => {
  it("meta_no_instagram có hướng xử lý", () => {
    const view = formatOAuthFlashError("meta_no_instagram");
    expect(view.title).toMatch(/Instagram/i);
    expect(view.hint).toMatch(/liên kết/i);
  });

  it("meta_failed không lộ chi tiết Graph", () => {
    const view = formatOAuthFlashError(
      "meta_failed",
      "Can't load URL: The domain of this URL isn't included in the app's domains",
    );
    expect(view.detail).toBeUndefined();
    expect(view.hint).toMatch(/tên miền/i);
  });
});

describe("formatOAuthFlashSuccess", () => {
  it("xác nhận đã nối Facebook, không nhắc webhook", () => {
    expect(formatOAuthFlashSuccess("facebook")).toMatch(/Facebook/i);
    expect(formatOAuthFlashSuccess("facebook")).not.toMatch(/webhook/i);
  });
});

describe("formatOAuthFlashWarning", () => {
  it("cảnh báo webhook Shopify chưa đăng ký", () => {
    expect(formatOAuthFlashWarning("shopify_webhook")).toMatch(/webhook/i);
    expect(formatOAuthFlashWarning("other")).toBeUndefined();
  });
});
