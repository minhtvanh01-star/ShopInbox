/** Thông báo OAuth trên Cài đặt — tiếng Việt, kèm hướng xử lý. */

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  meta_not_configured:
    "Chưa cấu hình OAuth Meta trên server (thiếu META_APP_ID hoặc META_APP_SECRET).",
  zalo_not_configured:
    "Chưa cấu hình OAuth Zalo trên server (thiếu ZALO_APP_ID hoặc ZALO_APP_SECRET).",
  meta_denied: "Bạn đã hủy cấp quyền trên Facebook.",
  zalo_denied: "Bạn đã hủy cấp quyền trên Zalo.",
  meta_state: "Phiên kết nối Meta hết hạn hoặc cookie bị chặn — bấm kết nối lại trong cùng một tab.",
  zalo_state: "Phiên kết nối Zalo hết hạn hoặc cookie bị chặn — bấm kết nối lại.",
  meta_invalid: "Facebook không trả mã xác thực về ShopInbox — kiểm tra Redirect URI trên Meta.",
  zalo_invalid: "Zalo không trả mã xác thực về ShopInbox — kiểm tra Redirect URI trên Zalo.",
  meta_no_pages:
    "Tài khoản Meta này không có Fanpage nào (hoặc bạn không đủ quyền admin/messaging trên Page).",
  meta_no_instagram:
    "Không thấy Instagram Business gắn với Fanpage. Liên kết IG Professional với Page rồi thử lại.",
  meta_failed: "Kết nối Meta thất bại.",
  zalo_failed: "Kết nối Zalo thất bại.",
};

const OAUTH_ERROR_HINTS: Record<string, string> = {
  meta_not_configured:
    "Điền biến vào .env (hoặc Railway), restart app. Checklist: docs/env-checklist.md.",
  zalo_not_configured: "Điền ZALO_APP_ID / ZALO_APP_SECRET, restart app. Xem docs/ket-noi-kenh.md.",
  meta_denied: "Bấm kết nối lại và chọn Cho phép khi Facebook hỏi quyền.",
  meta_state: "Tắt chặn cookie bên thứ ba cho domain app, rồi kết nối lại ngay (trong ~15 phút).",
  meta_invalid:
    "Trên Meta Developers → Facebook Login → Valid OAuth Redirect URIs phải khớp đúng URL callback trong Cài đặt.",
  meta_no_pages: "Dùng tài khoản là quản trị viên Fanpage cần nối.",
  meta_no_instagram:
    "Meta Business Suite / Page settings → liên kết Instagram Professional với đúng Fanpage.",
  meta_failed: "Đọc chi tiết bên dưới. Thường gặp: sai App Secret, Redirect URI, hoặc App Domains.",
  zalo_failed: "Đọc chi tiết bên dưới hoặc xem docs/ket-noi-kenh.md mục Zalo.",
};

/**
 * Gợi ý ngắn từ message Graph của Meta (locale EN/VI).
 * Không thay thế message gốc — chỉ thêm hướng xử lý.
 */
export function hintFromMetaGraphMessage(message: string): string | null {
  const text = message.toLowerCase();
  if (/redirect_uri|redirect uri|uri không hợp lệ|uri is not owned/i.test(message)) {
    return "Redirect URI trên Meta phải khớp từng ký tự với URL callback ShopInbox (kể cả https và không có dấu / thừa).";
  }
  if (/domain|miền|app domains|can't load url/i.test(text)) {
    return "Thêm hostname app vào App Domains và Website URL trên Meta (Settings → Basic), rồi Save.";
  }
  if (/invalid scope|permission|quyền/i.test(text) && /scope|invalid/i.test(text)) {
    return "App đang xin scope Meta không chấp nhận. ShopInbox chỉ dùng pages_show_list, pages_messaging, pages_manage_metadata.";
  }
  if (/access token|oauth|app secret|client_secret|ứng dụng/i.test(text) && /invalid|sai|expired|hết hạn/i.test(text)) {
    return "Kiểm tra META_APP_ID / META_APP_SECRET đúng app đang dùng; long-lived token có thể đã hết — nối lại kênh.";
  }
  if (/(#10)|outside|cửa sổ|khoảng thời gian cho phép|messaging window/i.test(message)) {
    return "Tin gửi ngoài cửa sổ messaging của Meta. Để khách nhắn lại rồi trả lời, hoặc dùng luồng HUMAN_AGENT nếu app đủ điều kiện.";
  }
  return null;
}

export type OAuthFlashErrorView = {
  title: string;
  hint?: string;
  detail?: string;
};

export function formatOAuthFlashError(
  code: string,
  detail?: string | null,
): OAuthFlashErrorView {
  const title = OAUTH_ERROR_MESSAGES[code] ?? "Kết nối OAuth thất bại.";
  const codeHint = OAUTH_ERROR_HINTS[code];
  const trimmed = detail?.trim() || undefined;
  const graphHint = trimmed ? hintFromMetaGraphMessage(trimmed) : null;

  const hintParts = [codeHint, graphHint].filter(Boolean);
  const hint = hintParts.length > 0 ? hintParts.join(" ") : undefined;

  return {
    title,
    hint,
    detail: trimmed && trimmed !== title ? trimmed : undefined,
  };
}

export function formatOAuthFlashSuccess(channelKey: string): string {
  if (channelKey === "facebook") return "Đã kết nối Facebook Messenger. Kiểm tra checklist webhook trong modal kênh.";
  if (channelKey === "instagram") return "Đã kết nối Instagram DM. Nếu Inbox chưa có tin, bấm Đồng bộ tin nhắn và kiểm tra webhook.";
  if (channelKey === "zalo") return "Đã kết nối Zalo OA. Dán Webhook URL vào Zalo OA Admin nếu chưa nhận tin.";
  return `Đã kết nối ${channelKey} thành công.`;
}
