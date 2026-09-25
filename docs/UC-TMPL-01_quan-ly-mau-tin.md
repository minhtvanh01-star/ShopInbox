# UC-TMPL-01: Quản lý mẫu tin nhắn

| **Mã:** | UC-TMPL-01 |
| ---: | :--- |
| **Tên:** | Quản lý mẫu tin nhắn |
| **Actor chính:** | Chủ shop (quyền `settings.update`) |
| **Mô tả:** | Chủ shop thêm / sửa / xóa mẫu tin nhanh trên Cài đặt. Nhân viên bấm nút mẫu trong Inbox để gửi đúng nội dung đã lưu. |
| **Điều kiện trước:** | Đã đăng nhập; có quyền cập nhật cài đặt. |
| **Điều kiện sau:** | Bản ghi `quick_replies` của shop được tạo/sửa/xóa; Inbox tải lại danh sách mẫu. |
| **Ưu tiên:** | Cao |
| **Luồng chính:** | 1. Chủ shop mở Cài đặt → mục Mẫu tin nhắn.<br>2. Hệ thống hiện danh sách mẫu (theo tiêu đề).<br>3. Chủ shop nhập tiêu đề + nội dung → Thêm mẫu tin.<br>4. Hệ thống validate, lưu DB, ghi audit, làm mới Cài đặt/Inbox.<br>5. Nhân viên mở Inbox thấy nút tiêu đề mới. |
| **Ngoại lệ:** | Trùng giới hạn 50 mẫu / shop; thiếu title/text; không đủ quyền. |
| **Code:** | `src/lib/quick-reply.ts`, `src/backend/quick-reply.ts`, `settings/actions.ts`, `QuickReplyManager.tsx` |
