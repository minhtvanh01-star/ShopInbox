import { describe, expect, it } from "vitest";
import { inviteEmailMatches, isInviteTokenShape, isInviteUsable } from "@/lib/shop-invite";

describe("shop invite", () => {
  it("rejects used, revoked, or expired invites", () => {
    const future = new Date("2026-10-01T00:00:00.000Z");
    const now = new Date("2026-09-26T00:00:00.000Z");
    expect(isInviteUsable({ expiresAt: future, usedAt: null, revokedAt: null }, now)).toBe(true);
    expect(
      isInviteUsable({ expiresAt: future, usedAt: now, revokedAt: null }, now),
    ).toBe(false);
    expect(
      isInviteUsable({ expiresAt: future, usedAt: null, revokedAt: now }, now),
    ).toBe(false);
    expect(
      isInviteUsable({
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        usedAt: null,
        revokedAt: null,
      }, now),
    ).toBe(false);
  });

  it("locks email only when the invite specified one", () => {
    expect(inviteEmailMatches(null, "a@b.co")).toBe(true);
    expect(inviteEmailMatches("A@B.co", "a@b.co")).toBe(true);
    expect(inviteEmailMatches("owner@shop.vn", "other@shop.vn")).toBe(false);
  });

  it("accepts url-safe tokens", () => {
    expect(isInviteTokenShape("abcDEF123_-zzzzxx")).toBe(true);
    expect(isInviteTokenShape("bad token")).toBe(false);
  });
});
