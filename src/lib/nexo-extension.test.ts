import { describe, expect, it } from "vitest";
import { nexoInboxUrl, offeredNexoAppOriginFromTab } from "./nexo-extension";

describe("nexo-extension", () => {
  it("mở Inbox trên origin Nexo", () => {
    expect(nexoInboxUrl("https://app.example/")).toBe("https://app.example/inbox");
    expect(nexoInboxUrl("ftp://x")).toBeNull();
  });

  it("chỉ gắn origin khi marker trùng tab", () => {
    expect(offeredNexoAppOriginFromTab("https://app.example/inbox", "https://app.example")).toBe(
      "https://app.example",
    );
    expect(offeredNexoAppOriginFromTab("https://www.facebook.com/", "https://app.example")).toBeNull();
    expect(offeredNexoAppOriginFromTab("https://app.example/login", null)).toBeNull();
  });
});
