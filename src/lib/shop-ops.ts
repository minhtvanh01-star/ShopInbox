export const SHOP_PLANS = ["trial", "starter", "pro", "business"] as const;
export type ShopPlanCode = (typeof SHOP_PLANS)[number];

export const SHOP_SUPPORT_STATUSES = ["ok", "watching", "needs_help", "in_progress"] as const;
export type ShopSupportStatusCode = (typeof SHOP_SUPPORT_STATUSES)[number];

export const SHOP_SUPPORT_TOPICS = ["none", "onboarding", "channel", "billing", "bug", "other"] as const;
export type ShopSupportTopicCode = (typeof SHOP_SUPPORT_TOPICS)[number];

export const SHOP_PLAN_LABEL: Record<ShopPlanCode, string> = {
  trial: "Dùng thử",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export const SHOP_SUPPORT_STATUS_LABEL: Record<ShopSupportStatusCode, string> = {
  ok: "Ổn",
  watching: "Theo dõi",
  needs_help: "Cần hỗ trợ",
  in_progress: "Đang xử lý",
};

export const SHOP_SUPPORT_TOPIC_LABEL: Record<ShopSupportTopicCode, string> = {
  none: "Không",
  onboarding: "Onboarding / setup",
  channel: "Kết nối kênh",
  billing: "Gói / thanh toán",
  bug: "Lỗi kỹ thuật",
  other: "Khác",
};

export const SUPPORT_NOTE_MAX = 400;

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function parseShopPlan(raw: unknown): ShopPlanCode | null {
  const value = String(raw ?? "").trim();
  return isOneOf(value, SHOP_PLANS) ? value : null;
}

export function parseShopSupportStatus(raw: unknown): ShopSupportStatusCode | null {
  const value = String(raw ?? "").trim();
  return isOneOf(value, SHOP_SUPPORT_STATUSES) ? value : null;
}

export function parseShopSupportTopic(raw: unknown): ShopSupportTopicCode | null {
  const value = String(raw ?? "").trim();
  return isOneOf(value, SHOP_SUPPORT_TOPICS) ? value : null;
}

export function parsePlanExpiresAt(raw: unknown): { ok: true; value: Date | null } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, value: null };
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Ngày hết hạn gói không hợp lệ." };
  }
  return { ok: true, value: date };
}

export function parseSupportNote(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (value.length > SUPPORT_NOTE_MAX) {
    return { ok: false, error: `Ghi chú hỗ trợ tối đa ${SUPPORT_NOTE_MAX} ký tự.` };
  }
  return { ok: true, value };
}

export function planExpiryInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export type ShopOpsInput = {
  planCode: ShopPlanCode;
  planExpiresAt: Date | null;
  supportStatus: ShopSupportStatusCode;
  supportTopic: ShopSupportTopicCode;
  supportNote: string;
};

export function parseShopOpsInput(raw: {
  planCode?: unknown;
  planExpiresAt?: unknown;
  supportStatus?: unknown;
  supportTopic?: unknown;
  supportNote?: unknown;
}): { ok: true; data: ShopOpsInput } | { ok: false; error: string } {
  const planCode = parseShopPlan(raw.planCode);
  const supportStatus = parseShopSupportStatus(raw.supportStatus);
  const supportTopic = parseShopSupportTopic(raw.supportTopic);
  if (!planCode) return { ok: false, error: "Gói không hợp lệ." };
  if (!supportStatus) return { ok: false, error: "Trạng thái hỗ trợ không hợp lệ." };
  if (!supportTopic) return { ok: false, error: "Nhu cầu hỗ trợ không hợp lệ." };
  const expires = parsePlanExpiresAt(raw.planExpiresAt);
  if (!expires.ok) return expires;
  const note = parseSupportNote(raw.supportNote);
  if (!note.ok) return note;
  return {
    ok: true,
    data: {
      planCode,
      planExpiresAt: expires.value,
      supportStatus,
      supportTopic,
      supportNote: note.value,
    },
  };
}
