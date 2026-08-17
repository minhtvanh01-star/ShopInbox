import { describe, expect, it } from "vitest";
import {
  CLAIM_OVERRIDE_STICKY_MS,
  evaluateReplyClaimAccess,
  evaluateReplyClaimRelease,
  evaluateReplyClaimTouch,
  formatReplyClaimCountdown,
  isReplyClaimActive,
  makeClaimOverride,
  reconcileClaimOverride,
  replyClaimRemainingMs,
  resolveReplyClaim,
  REPLY_CLAIM_TTL_MS,
} from "@/backend/reply-claim";

describe("reply claim", () => {
  it("is active within TTL", () => {
    const now = Date.parse("2026-08-15T10:00:00.000Z");
    expect(isReplyClaimActive(new Date(now - 60_000), now)).toBe(true);
    expect(isReplyClaimActive(new Date(now - REPLY_CLAIM_TTL_MS - 1), now)).toBe(false);
    expect(isReplyClaimActive(null, now)).toBe(false);
  });

  it("computes remaining idle time", () => {
    const now = Date.parse("2026-08-15T10:00:00.000Z");
    expect(replyClaimRemainingMs(new Date(now - 60_000), now)).toBe(REPLY_CLAIM_TTL_MS - 60_000);
    expect(replyClaimRemainingMs(new Date(now - REPLY_CLAIM_TTL_MS), now)).toBe(0);
    expect(formatReplyClaimCountdown(65_000)).toBe("1:05");
    expect(formatReplyClaimCountdown(5_000)).toBe("0:05");
  });

  it("formats a fresh 5-minute claim as 5:00 (not ~4:01)", () => {
    const now = Date.parse("2026-08-15T10:00:00.000Z");
    const ttlMs = 5 * 60_000;
    expect(replyClaimRemainingMs(new Date(now), now, ttlMs)).toBe(ttlMs);
    expect(formatReplyClaimCountdown(ttlMs)).toBe("5:00");
    // floor còn giây: 4:59 chấp nhận được; ceil đủ TTL vẫn 5:00
    expect(formatReplyClaimCountdown(ttlMs - 1)).toBe("5:00");
    expect(formatReplyClaimCountdown(ttlMs - 1000)).toBe("4:59");
    // Stale claimedAt ~59s (nowMs đóng băng) → hiện 4:01 — đây là bug UI đã sửa phía client
    expect(formatReplyClaimCountdown(replyClaimRemainingMs(new Date(now - 59_000), now, ttlMs))).toBe(
      "4:01",
    );
  });

  it("uses custom TTL when provided", () => {
    const now = Date.parse("2026-08-15T10:00:00.000Z");
    const ttlMs = 5 * 60_000;
    expect(isReplyClaimActive(new Date(now - 60_000), now, ttlMs)).toBe(true);
    expect(isReplyClaimActive(new Date(now - ttlMs - 1), now, ttlMs)).toBe(false);
    expect(replyClaimRemainingMs(new Date(now - 60_000), now, ttlMs)).toBe(ttlMs - 60_000);
    expect(
      resolveReplyClaim({
        staffId: "s1",
        staffName: "Minh",
        replyClaimedAt: new Date(now - ttlMs - 1).toISOString(),
        currentStaffId: "s2",
        now,
        ttlMs,
      }),
    ).toMatchObject({ active: false, staffId: null });
  });

  it("resolves mine vs other vs expired", () => {
    const now = Date.parse("2026-08-15T10:00:00.000Z");
    const claimedAt = new Date(now - 30_000).toISOString();

    expect(
      resolveReplyClaim({
        staffId: "s1",
        staffName: "Minh",
        replyClaimedAt: claimedAt,
        currentStaffId: "s1",
        now,
      }),
    ).toMatchObject({ active: true, isMine: true, staffName: "Minh" });

    expect(
      resolveReplyClaim({
        staffId: "s1",
        staffName: "Minh",
        replyClaimedAt: claimedAt,
        currentStaffId: "s2",
        now,
      }),
    ).toMatchObject({ active: true, isMine: false, staffId: "s1" });

    expect(
      resolveReplyClaim({
        staffId: "s1",
        staffName: "Minh",
        replyClaimedAt: new Date(now - REPLY_CLAIM_TTL_MS - 1).toISOString(),
        currentStaffId: "s2",
        now,
      }),
    ).toMatchObject({ active: false, isMine: false, staffId: null });
  });
});

describe("admin takeover / claim override sync", () => {
  const now = Date.parse("2026-08-17T03:00:00.000Z");
  const staffClaimedAt = new Date(now - 30_000).toISOString();
  const adminClaimedAt = new Date(now).toISOString();

  it("allows admin to take an active staff claim", () => {
    expect(
      evaluateReplyClaimAccess({
        isAdmin: true,
        currentStaffId: "admin",
        holderStaffId: "lan",
        holderName: "Lan",
        replyClaimedAt: staffClaimedAt,
        now,
      }),
    ).toEqual({ ok: true });
  });

  it("blocks staff from taking an active other claim", () => {
    expect(
      evaluateReplyClaimAccess({
        isAdmin: false,
        currentStaffId: "minh",
        holderStaffId: "lan",
        holderName: "Lan",
        replyClaimedAt: staffClaimedAt,
        now,
      }),
    ).toEqual({ ok: false, error: "Lan đang trả lời hội thoại này." });
  });

  it("lets admin release someone else's claim; staff cannot", () => {
    expect(
      evaluateReplyClaimRelease({
        isAdmin: true,
        currentStaffId: "admin",
        holderStaffId: "lan",
        replyClaimedAt: staffClaimedAt,
        now,
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateReplyClaimRelease({
        isAdmin: false,
        currentStaffId: "minh",
        holderStaffId: "lan",
        replyClaimedAt: staffClaimedAt,
        now,
      }).ok,
    ).toBe(false);
  });

  it("does not let admin heartbeat steal a staff claim", () => {
    expect(
      evaluateReplyClaimTouch({
        isAdmin: true,
        currentStaffId: "admin",
        holderStaffId: "lan",
        replyClaimedAt: staffClaimedAt,
        now,
      }),
    ).toEqual({ ok: true, renew: false });
    expect(
      evaluateReplyClaimTouch({
        isAdmin: true,
        currentStaffId: "admin",
        holderStaffId: "admin",
        replyClaimedAt: adminClaimedAt,
        now,
      }),
    ).toEqual({ ok: true, renew: true });
  });

  it("keeps newer admin takeover over stale staff RSC so toolbar leaves Tiếp quản", () => {
    const override = makeClaimOverride({
      replyStaffId: "admin",
      replyStaffName: "Chủ shop",
      replyClaimedAt: adminClaimedAt,
      nowMs: now,
    });
    expect(
      reconcileClaimOverride({
        serverStaffId: "lan",
        serverClaimedAt: staffClaimedAt,
        override,
        nowMs: now,
      }),
    ).toBe("keep");

    const resolved = resolveReplyClaim({
      staffId: override.replyStaffId,
      staffName: override.replyStaffName,
      replyClaimedAt: override.replyClaimedAt,
      currentStaffId: "admin",
      now,
    });
    expect(resolved).toMatchObject({ active: true, isMine: true, staffId: "admin" });
  });

  it("keeps in-flight local release while sticky even if server still has staff", () => {
    const override = makeClaimOverride({
      replyStaffId: null,
      replyStaffName: null,
      replyClaimedAt: null,
      nowMs: now,
    });
    expect(
      reconcileClaimOverride({
        serverStaffId: "lan",
        serverClaimedAt: staffClaimedAt,
        override,
        nowMs: now,
      }),
    ).toBe("keep");
  });

  it("drops leftover local claim after sticky when server already released", () => {
    const override = makeClaimOverride({
      replyStaffId: "admin",
      replyStaffName: "Chủ shop",
      replyClaimedAt: adminClaimedAt,
      nowMs: now,
    });
    expect(
      reconcileClaimOverride({
        serverStaffId: null,
        serverClaimedAt: null,
        override,
        nowMs: now + CLAIM_OVERRIDE_STICKY_MS + 1,
      }),
    ).toBe("drop");
  });

  it("trusts a newer server claimant after sticky expires", () => {
    const override = makeClaimOverride({
      replyStaffId: "admin",
      replyStaffName: "Chủ shop",
      replyClaimedAt: adminClaimedAt,
      nowMs: now,
    });
    expect(
      reconcileClaimOverride({
        serverStaffId: "lan",
        serverClaimedAt: new Date(now + 5_000).toISOString(),
        override,
        nowMs: now + CLAIM_OVERRIDE_STICKY_MS + 1,
      }),
    ).toBe("drop");
  });
});
