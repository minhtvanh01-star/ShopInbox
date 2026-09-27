/** Thông báo OAuth trên Cài đặt — tiếng Việt, kèm hướng xử lý. */

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  meta_not_configured: "Kết nối Facebook/Instagram chưa sẵn sàng trên hệ thống. Liên hệ quản trị.",
  zalo_not_configured: "Kết nối Zalo chưa sẵn sàng trên hệ thống. Liên hệ quản trị.",
  meta_denied: "Bạn đã hủy cấp quyền trên Facebook.",
  zalo_denied: "Bạn đã hủy cấp quyền trên Zalo.",
  meta_state: "Phiên kết nối Meta hết hạn hoặc cookie bị chặn — bấm kết nối lại trong cùng một tab.",
  zalo_state: "Phiên kết nối Zalo hết hạn hoặc cookie bị chặn — bấm kết nối lại.",
  meta_invalid: "Facebook không hoàn tất kết nối. Thử lại hoặc dùng tài khoản admin Fanpage.",
  zalo_invalid: "Zalo không hoàn tất kết nối. Thử lại hoặc dùng tài khoản quản trị OA.",
  meta_no_pages:
    "Tài khoản Meta này không có Fanpage nào (hoặc bạn không đủ quyền admin/messaging trên Page).",
  meta_no_instagram:
    "Không thấy Instagram Business gắn với Fanpage. Liên kết IG Professional với Page rồi thử lại.",
  meta_failed: "Kết nối Facebook/Instagram thất bại. Thử lại sau.",
  zalo_failed: "Kết nối Zalo thất bại. Thử lại sau.",
  shopify_not_configured: "Kết nối Shopify chưa sẵn sàng trên hệ thống. Liên hệ quản trị.",
  shopify_denied: "Bạn đã hủy cấp quyền trên Shopify.",
  shopify_state: "Phiên kết nối Shopify hết hạn hoặc cookie bị chặn — bấm kết nối lại.",
  shopify_invalid: "Shopify không hoàn tất kết nối. Kiểm tra domain *.myshopify.com rồi thử lại.",
  shopify_failed: "Kết nối Shopify thất bại. Thử lại sau.",
};

export function formatOAuthFlashWarning(code: string): string | undefined {
  if (code === "shopify_webhook") {
    return "Cửa hàng đã nối nhưng webhook gỡ app chưa đăng ký được. Kiểm tra URL công khai rồi nối lại.";
  }
  return undefined;
}

const OAUTH_ERROR_HINTS: Record<string, string> = {
  meta_denied: "Bấm kết nối lại và chọn Cho phép khi Facebook hỏi quyền.",
  meta_state: "Tắt chặn cookie bên thứ ba cho domain app, rồi kết nối lại ngay (trong ~15 phút).",
  meta_no_pages: "Dùng tài khoản là quản trị viên Fanpage cần nối.",
  meta_no_instagram:
    "Meta Business Suite / Page settings → liên kết Instagram Professional với đúng Fanpage.",
};

/**
 * Gợi ý ngắn từ message Graph của Meta (locale EN/VI).
 * Không thay thế message gốc — chỉ thêm hướng xử lý.
 */
export function hintFromMetaGraphMessage(message: string): string | null {
  const text = message.toLowerCase();
  if (/redirect_uri|redirect uri|uri không hợp lệ|uri is not owned/i.test(message)) {
    return "Kết nối chưa khớp cấu hình Facebook. Liên hệ quản trị rồi thử lại.";
  }
  if (/domain|miền|app domains|can't load url/i.test(text)) {
    return "Facebook chưa chấp nhận tên miền ứng dụng. Liên hệ quản trị rồi thử lại.";
  }
  if (/invalid scope|permission|quyền/i.test(text) && /scope|invalid/i.test(text)) {
    return "Facebook chưa cấp đủ quyền. Dùng tài khoản admin Fanpage rồi thử lại.";
  }
  if (/access token|oauth|app secret|client_secret|ứng dụng/i.test(text) && /invalid|sai|expired|hết hạn/i.test(text)) {
    return "Phiên Facebook hết hạn hoặc không hợp lệ. Nối lại kênh.";
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
  };
}

export function formatOAuthFlashSuccess(channelKey: string): string {
  if (channelKey === "facebook") return "Đã kết nối Facebook Messenger.";
  if (channelKey === "instagram") return "Đã kết nối Instagram DM.";
  if (channelKey === "zalo") return "Đã kết nối Zalo OA.";
  if (channelKey === "shopify") return "Đã kết nối cửa hàng Shopify.";
  return `Đã kết nối ${channelKey} thành công.`;
}
