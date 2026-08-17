import { describe, expect, it } from "vitest";
import {
  formatReplyClaimCountdown,
  isReplyClaimActive,
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
