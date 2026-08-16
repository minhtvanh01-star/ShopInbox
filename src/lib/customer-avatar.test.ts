import { describe, expect, it } from "vitest";
import { normalizeCustomerAvatarUrl } from "./customer-avatar";

describe("normalizeCustomerAvatarUrl", () => {
  it("accepts https URLs", () => {
    expect(normalizeCustomerAvatarUrl(" https://cdn.example.com/a.png ")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("rejects non-https and junk", () => {
    expect(normalizeCustomerAvatarUrl("http://cdn.example.com/a.png")).toBeNull();
    expect(normalizeCustomerAvatarUrl("ftp://x")).toBeNull();
    expect(normalizeCustomerAvatarUrl("not-a-url")).toBeNull();
    expect(normalizeCustomerAvatarUrl("")).toBeNull();
    expect(normalizeCustomerAvatarUrl(null)).toBeNull();
  });
});
