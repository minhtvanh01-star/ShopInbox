import { describe, expect, it } from "vitest";
import {
  formatOAuthFlashError,
  formatOAuthFlashSuccess,
  hintFromMetaGraphMessage,
} from "./oauth-flash";

describe("hintFromMetaGraphMessage", () => {
  it("nhận Redirect URI", () => {
    expect(hintFromMetaGraphMessage("Invalid redirect_uri")).toMatch(/Redirect URI/i);
  });

  it("nhận lỗi miền tiếng Việt", () => {
    expect(
      hintFromMetaGraphMessage("Miền của URL này không được đưa vào miền của ứng dụng"),
    ).toMatch(/App Domains/i);
  });

  it("trả null khi không khớp", () => {
    expect(hintFromMetaGraphMessage("something else")).toBeNull();
  });
});

describe("formatOAuthFlashError", () => {
  it("meta_no_instagram có hướng xử lý", () => {
    const view = formatOAuthFlashError("meta_no_instagram");
    expect(view.title).toMatch(/Instagram/i);
    expect(view.hint).toMatch(/liên kết/i);
  });

  it("meta_failed kèm detail Graph", () => {
    const view = formatOAuthFlashError(
      "meta_failed",
      "Can't load URL: The domain of this URL isn't included in the app's domains",
    );
    expect(view.detail).toMatch(/domain/i);
    expect(view.hint).toMatch(/App Domains/i);
  });
});

describe("formatOAuthFlashSuccess", () => {
  it("gợi ý bước tiếp theo sau Facebook", () => {
    expect(formatOAuthFlashSuccess("facebook")).toMatch(/webhook/i);
  });
});
