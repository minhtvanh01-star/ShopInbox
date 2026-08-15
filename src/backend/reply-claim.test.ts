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
