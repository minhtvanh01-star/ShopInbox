/** Defaults + validation cho cấu hình vận hành theo shop. */

export const DEFAULT_REPLY_CLAIM_TTL_MINUTES = 15;
export const DEFAULT_MAX_USERS_PER_SHOP = 3;

export const REPLY_CLAIM_TTL_MIN = 5;
export const REPLY_CLAIM_TTL_MAX = 120;
export const MAX_USERS_PER_SHOP_MIN = 1;
/** Trần bản chạy thử — khớp MAX_USERS_PER_SHOP. */
export const MAX_USERS_PER_SHOP_MAX = 5;

export type ShopPolicy = {
  replyClaimTtlMinutes: number;
  maxUsersPerShop: number;
};

export const DEFAULT_SHOP_POLICY: ShopPolicy = {
  replyClaimTtlMinutes: DEFAULT_REPLY_CLAIM_TTL_MINUTES,
  maxUsersPerShop: DEFAULT_MAX_USERS_PER_SHOP,
};

export function replyClaimTtlMs(minutes: number = DEFAULT_REPLY_CLAIM_TTL_MINUTES) {
  return Math.max(1, minutes) * 60 * 1000;
}

export function normalizeReplyClaimTtlMinutes(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < REPLY_CLAIM_TTL_MIN || rounded > REPLY_CLAIM_TTL_MAX) return null;
  return rounded;
}

export function normalizeMaxUsersPerShop(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < MAX_USERS_PER_SHOP_MIN || rounded > MAX_USERS_PER_SHOP_MAX) return null;
  return rounded;
}

export function parseShopPolicyInput(input: {
  replyClaimTtlMinutes?: unknown;
  maxUsersPerShop?: unknown;
}): { ok: true; policy: ShopPolicy } | { ok: false; error: string } {
  const replyClaimTtlMinutes = normalizeReplyClaimTtlMinutes(input.replyClaimTtlMinutes);
  const maxUsersPerShop = normalizeMaxUsersPerShop(input.maxUsersPerShop);
  if (replyClaimTtlMinutes === null) {
    return {
      ok: false,
      error: `Thời gian nhả hội thoại phải từ ${REPLY_CLAIM_TTL_MIN}–${REPLY_CLAIM_TTL_MAX} phút.`,
    };
  }
  if (maxUsersPerShop === null) {
    return {
      ok: false,
      error: `Số thành viên tối đa phải từ ${MAX_USERS_PER_SHOP_MIN}–${MAX_USERS_PER_SHOP_MAX}.`,
    };
  }
  return { ok: true, policy: { replyClaimTtlMinutes, maxUsersPerShop } };
}
