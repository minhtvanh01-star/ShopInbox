/** Claim hội thoại khi nhân viên đang trả lời — người khác không gửi được. */

import {
  DEFAULT_REPLY_CLAIM_TTL_MINUTES,
  replyClaimTtlMs,
} from "@/lib/shop-policy";

/** Default TTL (ms) — khớp default shop khi chưa đọc DB. */
export const REPLY_CLAIM_TTL_MS = replyClaimTtlMs(DEFAULT_REPLY_CLAIM_TTL_MINUTES);
export const REPLY_CLAIM_TTL_MINUTES = DEFAULT_REPLY_CLAIM_TTL_MINUTES;

export function isReplyClaimActive(
  claimedAt: Date | string | null | undefined,
  now = Date.now(),
  ttlMs: number = REPLY_CLAIM_TTL_MS,
) {
  return replyClaimRemainingMs(claimedAt, now, ttlMs) > 0;
}

export function replyClaimRemainingMs(
  claimedAt: Date | string | null | undefined,
  now = Date.now(),
  ttlMs: number = REPLY_CLAIM_TTL_MS,
) {
  if (!claimedAt) {
    return 0;
  }
  const ts = typeof claimedAt === "string" ? Date.parse(claimedAt) : claimedAt.getTime();
  if (!Number.isFinite(ts)) {
    return 0;
  }
  const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : REPLY_CLAIM_TTL_MS;
  return Math.max(0, ts + ttl - now);
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
  ttlMs?: number;
}): ReplyClaimState {
  const claimedAt =
    input.replyClaimedAt instanceof Date
      ? input.replyClaimedAt.toISOString()
      : input.replyClaimedAt ?? null;
  const active =
    Boolean(input.staffId) &&
    isReplyClaimActive(input.replyClaimedAt, input.now, input.ttlMs);
  return {
    staffId: active ? (input.staffId ?? null) : null,
    staffName: active ? (input.staffName ?? null) : null,
    claimedAt: active ? claimedAt : null,
    active,
    isMine: active && input.staffId === input.currentStaffId,
  };
}

/** Giữ override local một lúc để soft-refresh stale không xóa takeover/nhả vừa xong. */
export const CLAIM_OVERRIDE_STICKY_MS = 30_000;

export type ClaimOverride = {
  replyStaffId: string | null;
  replyStaffName: string | null;
  replyClaimedAt: string | null;
  stickyUntilMs?: number;
};

export function makeClaimOverride(input: {
  replyStaffId: string | null;
  replyStaffName: string | null;
  replyClaimedAt: string | null;
  nowMs?: number;
  stickyMs?: number;
}): ClaimOverride {
  const nowMs = input.nowMs ?? Date.now();
  return {
    replyStaffId: input.replyStaffId,
    replyStaffName: input.replyStaffName,
    replyClaimedAt: input.replyClaimedAt,
    stickyUntilMs: nowMs + (input.stickyMs ?? CLAIM_OVERRIDE_STICKY_MS),
  };
}

function claimedAtMillis(value: string | Date | null | undefined) {
  if (!value) return 0;
  const ts = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Soft-refresh / RSC stale không được xóa takeover admin hoặc nhả vừa bấm.
 * Sticky: giữ local. Hết sticky: tin server (kể cả server đã nhả).
 */
export function reconcileClaimOverride(input: {
  serverStaffId: string | null | undefined;
  serverClaimedAt: string | null | undefined;
  override: ClaimOverride;
  nowMs?: number;
}): "keep" | "drop" {
  const now = input.nowMs ?? Date.now();
  const serverStaff = input.serverStaffId ?? null;
  const overrideStaff = input.override.replyStaffId ?? null;
  const serverCleared = !serverStaff && !input.serverClaimedAt;
  const overrideCleared = !overrideStaff && !input.override.replyClaimedAt;
  const sameClaimant = serverStaff === overrideStaff;
  const sticky = (input.override.stickyUntilMs ?? 0) > now;

  if (overrideCleared && serverCleared) {
    return "drop";
  }

  if (sticky) {
    return "keep";
  }

  if (serverCleared && !overrideCleared) {
    return "drop";
  }

  if (!sameClaimant) {
    if (overrideCleared) {
      return "drop";
    }
    const overrideTs = claimedAtMillis(input.override.replyClaimedAt);
    const serverTs = claimedAtMillis(input.serverClaimedAt);
    return overrideTs >= serverTs ? "keep" : "drop";
  }

  return "keep";
}

export function evaluateReplyClaimAccess(input: {
  isAdmin: boolean;
  currentStaffId: string;
  holderStaffId: string | null | undefined;
  holderName?: string | null;
  replyClaimedAt: Date | string | null | undefined;
  now?: number;
  ttlMs?: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.isAdmin) {
    return { ok: true };
  }
  if (
    input.holderStaffId &&
    input.holderStaffId !== input.currentStaffId &&
    isReplyClaimActive(input.replyClaimedAt, input.now, input.ttlMs)
  ) {
    return {
      ok: false,
      error: `${input.holderName?.trim() || "Nhân viên khác"} đang trả lời hội thoại này.`,
    };
  }
  return { ok: true };
}

export function evaluateReplyClaimRelease(input: {
  isAdmin: boolean;
  currentStaffId: string;
  holderStaffId: string | null | undefined;
  replyClaimedAt: Date | string | null | undefined;
  now?: number;
  ttlMs?: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.isAdmin) {
    return { ok: true };
  }
  if (
    input.holderStaffId &&
    input.holderStaffId !== input.currentStaffId &&
    isReplyClaimActive(input.replyClaimedAt, input.now, input.ttlMs)
  ) {
    return { ok: false, error: "Chỉ người đang trả lời mới nhả được hội thoại." };
  }
  return { ok: true };
}

export function evaluateReplyClaimTouch(input: {
  isAdmin: boolean;
  currentStaffId: string;
  holderStaffId: string | null | undefined;
  replyClaimedAt: Date | string | null | undefined;
  now?: number;
  ttlMs?: number;
}): { ok: true; renew: boolean } | { ok: false; error: string } {
  const holding =
    input.holderStaffId === input.currentStaffId &&
    isReplyClaimActive(input.replyClaimedAt, input.now, input.ttlMs);
  if (input.isAdmin) {
    // Admin không gia hạn/cướp claim của NV qua heartbeat — chỉ renew khi chính admin đang giữ.
    return { ok: true, renew: holding };
  }
  if (!holding) {
    return { ok: false, error: "Bạn không còn giữ hội thoại này." };
  }
  return { ok: true, renew: true };
}
