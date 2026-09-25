import { VN_TIME_ZONE } from "./labels";

export const AUTO_REPLY_KINDS = ["off_hours", "keyword"] as const;
export type AutoReplyKind = (typeof AUTO_REPLY_KINDS)[number];

export const AUTO_REPLY_MAX_PER_SHOP = 20;
export const AUTO_REPLY_TEXT_MAX = 1000;
export const AUTO_REPLY_KEYWORD_MAX = 12;
export const AUTO_REPLY_COOLDOWN_MIN = 15;
export const AUTO_REPLY_COOLDOWN_MAX = 24 * 60;

export type AutoReplyRuleMatchInput = {
  kind: string;
  enabled: boolean;
  keywords: string;
  replyText: string;
  openMinute: number | null;
  closeMinute: number | null;
  sortOrder: number;
  cooldownMinutes?: number;
};

/** Phút từ nửa đêm theo Asia/Ho_Chi_Minh. */
export function vietnamMinuteOfDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** Parse "09:00" / "9:30" → phút; null nếu sai. */
export function parseHourMinute(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatHourMinute(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** true = đang trong giờ mở cửa (không gửi off_hours). */
export function isWithinBusinessHours(
  openMinute: number,
  closeMinute: number,
  nowMinute: number,
): boolean {
  if (openMinute === closeMinute) {
    return true;
  }
  if (openMinute < closeMinute) {
    return nowMinute >= openMinute && nowMinute < closeMinute;
  }
  // Qua đêm: ví dụ 22:00–08:00
  return nowMinute >= openMinute || nowMinute < closeMinute;
}

export function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, AUTO_REPLY_KEYWORD_MAX);
}

function escapeKeywordPattern(keyword: string) {
  return keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function textMatchesKeywords(text: string, keywordsCsv: string): boolean {
  const keywords = parseKeywords(keywordsCsv);
  if (keywords.length === 0) return false;
  const haystack = text.trim().toLowerCase();
  if (!haystack) return false;
  return keywords.some((keyword) => {
    const pattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}_])${escapeKeywordPattern(keyword)}(?:[^\\p{L}\\p{N}_]|$)`,
      "iu",
    );
    return pattern.test(haystack);
  });
}

/**
 * Chọn rule đầu tiên khớp: keyword trước (theo sortOrder), rồi off_hours.
 */
export function pickAutoReplyMatch(input: {
  customerText: string;
  rules: AutoReplyRuleMatchInput[];
  now?: Date;
}): { replyText: string; cooldownMinutes: number } | null {
  const nowMinute = vietnamMinuteOfDay(input.now ?? new Date());
  const enabled = input.rules
    .filter((rule) => rule.enabled && rule.replyText.trim())
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.kind.localeCompare(b.kind));

  for (const rule of enabled.filter((item) => item.kind === "keyword")) {
    if (textMatchesKeywords(input.customerText, rule.keywords)) {
      return {
        replyText: rule.replyText.trim(),
        cooldownMinutes: rule.cooldownMinutes ?? 120,
      };
    }
  }

  for (const rule of enabled.filter((item) => item.kind === "off_hours")) {
    if (rule.openMinute === null || rule.closeMinute === null) continue;
    if (!isWithinBusinessHours(rule.openMinute, rule.closeMinute, nowMinute)) {
      return {
        replyText: rule.replyText.trim(),
        cooldownMinutes: rule.cooldownMinutes ?? 120,
      };
    }
  }

  return null;
}

/** @deprecated dùng pickAutoReplyMatch */
export function pickAutoReplyText(input: {
  customerText: string;
  rules: AutoReplyRuleMatchInput[];
  now?: Date;
}): string | null {
  return pickAutoReplyMatch(input)?.replyText ?? null;
}

export function parseAutoReplyRuleInput(raw: {
  kind?: string | null;
  keywords?: string | null;
  replyText?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  cooldownMinutes?: unknown;
  enabled?: unknown;
}):
  | {
      ok: true;
      value: {
        kind: AutoReplyKind;
        keywords: string;
        replyText: string;
        openMinute: number | null;
        closeMinute: number | null;
        cooldownMinutes: number;
        enabled: boolean;
      };
    }
  | { ok: false; error: string } {
  const kind = (raw.kind ?? "").trim();
  if (kind !== "off_hours" && kind !== "keyword") {
    return { ok: false, error: "Loại rule không hợp lệ (off_hours hoặc keyword)." };
  }

  const replyText = (raw.replyText ?? "").trim();
  if (!replyText) {
    return { ok: false, error: "Nhập nội dung trả lời tự động." };
  }
  if (replyText.length > AUTO_REPLY_TEXT_MAX) {
    return { ok: false, error: `Nội dung tối đa ${AUTO_REPLY_TEXT_MAX} ký tự.` };
  }

  const enabled = raw.enabled === true || raw.enabled === "true" || raw.enabled === "on" || raw.enabled === "1";
  // Form checkbox: missing = tắt. undefined chỉ khi gọi API nội bộ không truyền field → mặc định bật.
  const enabledFlag =
    raw.enabled === undefined || raw.enabled === null ? true : Boolean(enabled);

  let cooldown = Number(raw.cooldownMinutes);
  if (!Number.isFinite(cooldown)) cooldown = 120;
  cooldown = Math.round(cooldown);
  if (cooldown < AUTO_REPLY_COOLDOWN_MIN || cooldown > AUTO_REPLY_COOLDOWN_MAX) {
    return {
      ok: false,
      error: `Cooldown phải từ ${AUTO_REPLY_COOLDOWN_MIN}–${AUTO_REPLY_COOLDOWN_MAX} phút.`,
    };
  }

  if (kind === "keyword") {
    const keywords = parseKeywords(raw.keywords ?? "");
    if (keywords.length === 0) {
      return { ok: false, error: "Thêm ít nhất một từ khóa (cách nhau bằng dấu phẩy)." };
    }
    return {
      ok: true,
      value: {
        kind,
        keywords: keywords.join(", "),
        replyText,
        openMinute: null,
        closeMinute: null,
        cooldownMinutes: cooldown,
        enabled: enabledFlag,
      },
    };
  }

  const openMinute = parseHourMinute(raw.openTime);
  const closeMinute = parseHourMinute(raw.closeTime);
  if (openMinute === null || closeMinute === null) {
    return { ok: false, error: "Giờ mở/đóng cửa phải dạng HH:MM (ví dụ 09:00, 18:30)." };
  }
  if (openMinute === closeMinute) {
    return { ok: false, error: "Giờ mở và đóng cửa không được trùng nhau." };
  }

  return {
    ok: true,
    value: {
      kind,
      keywords: "",
      replyText,
      openMinute,
      closeMinute,
      cooldownMinutes: cooldown,
      enabled: enabledFlag,
    },
  };
}
