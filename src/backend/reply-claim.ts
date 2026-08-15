/** Claim hội thoại khi nhân viên đang trả lời — người khác không gửi được. */

/** Mỗi lần nhận/gửi/gia hạn: còn hiệu lực 15 phút nếu không còn hoạt động. */
export const REPLY_CLAIM_TTL_MS = 15 * 60 * 1000;
export const REPLY_CLAIM_TTL_MINUTES = 15;

export function isReplyClaimActive(
  claimedAt: Date | string | null | undefined,
  now = Date.now(),
) {
  return replyClaimRemainingMs(claimedAt, now) > 0;
}

export function replyClaimRemainingMs(
  claimedAt: Date | string | null | undefined,
  now = Date.now(),
) {
  if (!claimedAt) {
    return 0;
  }
  const ts = typeof claimedAt === "string" ? Date.parse(claimedAt) : claimedAt.getTime();
  if (!Number.isFinite(ts)) {
    return 0;
  }
  return Math.max(0, ts + REPLY_CLAIM_TTL_MS - now);
}

/** mm:ss còn lại trước khi hết hạn claim vì không dùng. */
export function formatReplyClaimCountdown(remainingMs: number) {
  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type ReplyClaimState = {
  staffId: string | null;
  staffName: string | null;
  claimedAt: string | null;
  active: boolean;
  isMine: boolean;
};

export function resolveReplyClaim(input: {
  staffId: string | null | undefined;
  staffName: string | null | undefined;
  replyClaimedAt: Date | string | null | undefined;
  currentStaffId: string;
  now?: number;
}): ReplyClaimState {
  const claimedAt =
    input.replyClaimedAt instanceof Date
      ? input.replyClaimedAt.toISOString()
      : input.replyClaimedAt ?? null;
  const active = Boolean(input.staffId) && isReplyClaimActive(input.replyClaimedAt, input.now);
  return {
    staffId: active ? (input.staffId ?? null) : null,
    staffName: active ? (input.staffName ?? null) : null,
    claimedAt: active ? claimedAt : null,
    active,
    isMine: active && input.staffId === input.currentStaffId,
  };
}
