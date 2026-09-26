export const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google OAuth chưa được cấu hình trên server.",
  google_denied: "Bạn đã hủy đăng nhập Google.",
  google_invalid: "Phản hồi Google không hợp lệ.",
  google_state: "Phiên OAuth hết hạn hoặc không khớp — thử lại.",
  google_failed: "Đăng nhập Google thất bại.",
  google_redirect:
    "URI chuyển hướng Google không khớp. Trong Console → Credentials → Authorized redirect URIs phải có đúng https://<domain>/api/auth/google/callback. Trên VPS đặt GOOGLE_REDIRECT_URI giống vậy rồi restart (không cần rebuild).",
  google_client: "Client ID hoặc Client secret trên server không khớp Google Console.",
  google_grant: "Mã Google hết hạn hoặc không khớp. Bấm lại Tiếp tục với Google.",
  google_email_unverified: "Email Google chưa được xác minh. Dùng tài khoản Google đã xác thực email.",
  google_email_linked_other: "Email đã liên kết tài khoản Google khác.",
  google_already_linked: "Tài khoản đã liên kết Google.",
  google_account_taken: "Tài khoản Google này đã được dùng.",
  google_email_taken: "Email Google trùng với tài khoản khác.",
  google_account_exists:
    "Email này đã đăng ký bằng mật khẩu. Đăng nhập bằng mật khẩu, rồi liên kết Google trong Hồ sơ.",
  google_already_registered: "Tài khoản Google này đã tồn tại. Hãy đăng nhập.",
  google_no_account: "Chưa có tài khoản với Google này. Hãy đăng ký trước.",
  google_id_token: "Không xác minh được token Google.",
  google_linked: "Đã liên kết Google thành công.",
  inactive:
    "Tài khoản chưa được kích hoạt hoặc đã bị tắt. Liên hệ quản trị viên để phê duyệt và phân quyền.",
  shop_seat_full:
    "Shop đã đủ số thành viên đang hoạt động. Liên hệ admin để giải phóng ghế trước khi đăng ký thêm.",
  shop_suspended: "Cửa hàng đang bị tạm khóa. Liên hệ Super admin.",
};

/** Flash success trên /login sau đăng ký mở (email OTP / Google). */
export const AUTH_SUCCESS_MESSAGES: Record<string, string> = {
  pending_approval:
    "Tài khoản đã tạo. Chờ quản trị viên phê duyệt và phân quyền trước khi đăng nhập.",
};
