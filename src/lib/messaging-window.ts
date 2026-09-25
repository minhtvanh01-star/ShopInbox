import type { Channel } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const STANDARD_WINDOW_MS = 24 * HOUR_MS;
/** Messenger Human Agent: tối đa 7 ngày sau tin khách (cần App Review). */
const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR_MS;
/** Zalo Tin tư vấn miễn phí: 48 giờ sau tin khách. */
const ZALO_FREE_WINDOW_MS = 48 * HOUR_MS;
/** Zalo OpenAPI / CS trả phí: tối đa 7 ngày sau tin khách. */
const ZALO_OPENAPI_WINDOW_MS = 7 * 24 * HOUR_MS;

export type MessagingWindowKind = "open" | "human_agent" | "closed" | "local" | "unknown";

export type MessagingWindowInfo = {
  kind: MessagingWindowKind;
  /** Một dòng ngắn hiện trên composer. */
  banner: string | null;
};

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Ước lượng cửa sổ messaging Meta theo tin khách gần nhất trong thread.
 * Không thay thế lỗi Graph — chỉ cảnh báo trước khi gửi.
 */
export function getMessagingWindowInfo(input: {
  channel: Channel;
  lastCustomerMessageAt?: Date | string | null;
  now?: Date;
}): MessagingWindowInfo {
  const { channel } = input;
  if (channel === "web") {
    return { kind: "local", banner: null };
  }

  const lastMs = toTime(input.lastCustomerMessageAt);
  if (lastMs === null) {
    return {
      kind: "unknown",
      banner:
        channel === "zalo"
          ? "Chưa có tin khách trên Zalo trong hội thoại này — gửi có thể thất bại nếu thiếu ID khách."
          : "Chưa thấy tin khách gần đây. Meta chỉ cho trả lời tự do trong 24 giờ sau tin khách.",
    };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const age = nowMs - lastMs;
  if (age < 0) {
    return { kind: "open", banner: null };
  }

  if (channel === "zalo") {
    if (age <= ZALO_FREE_WINDOW_MS) {
      return { kind: "open", banner: null };
    }
    if (age <= ZALO_OPENAPI_WINDOW_MS) {
      return {
        kind: "human_agent",
        banner:
          "Đã quá 48 giờ kể từ tin khách. Cửa sổ Tin tư vấn miễn phí của Zalo đã hết — OpenAPI có thể gửi thêm ≤7 ngày nếu OA đủ điều kiện; nếu lỗi, nhờ khách nhắn lại.",
      };
    }
    return {
      kind: "closed",
      banner: "Đã quá 7 ngày trên Zalo. Cần khách nhắn lại trước khi trả lời.",
    };
  }

  if (age <= STANDARD_WINDOW_MS) {
    return { kind: "open", banner: null };
  }

  if (channel === "facebook" && age <= HUMAN_AGENT_WINDOW_MS) {
    return {
      kind: "human_agent",
      banner:
        "Đã quá 24 giờ kể từ tin khách. Facebook có thể gửi bằng thẻ Human Agent (≤7 ngày) nếu app đã được Meta duyệt — nếu lỗi, nhờ khách nhắn lại.",
    };
  }

  if (channel === "instagram") {
    return {
      kind: "closed",
      banner:
        "Đã quá 24 giờ trên Instagram DM. API không hỗ trợ Human Agent — cần khách nhắn lại rồi mới trả lời được.",
    };
  }

  if (channel === "facebook") {
    return {
      kind: "closed",
      banner:
        "Đã quá 7 ngày kể từ tin khách. Messenger không cho gửi thêm — cần khách nhắn lại.",
    };
  }

  return {
    kind: "closed",
    banner: "Có thể đã hết cửa sổ trả lời trên kênh này — nếu gửi lỗi, nhờ khách nhắn lại.",
  };
}

/** Lấy thời điểm tin khách mới nhất trong danh sách tin (ISO / Date). */
export function latestCustomerMessageAt(
  messages: Array<{ sender: string; createdAt: Date | string }>,
): string | null {
  let latest: number | null = null;
  for (const item of messages) {
    if (item.sender !== "customer") continue;
    const ms = toTime(item.createdAt);
    if (ms === null) continue;
    if (latest === null || ms > latest) latest = ms;
  }
  return latest === null ? null : new Date(latest).toISOString();
}
