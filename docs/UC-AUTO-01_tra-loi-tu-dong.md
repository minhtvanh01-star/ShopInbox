# UC-AUTO-01: Cấu hình trả lời tự động

| **Mã:** | UC-AUTO-01 |
| ---: | :--- |
| **Tên:** | Cấu hình trả lời tự động |
| **Actor:** | Chủ shop (`settings.update`) |
| **Mô tả:** | Chủ shop tạo rule keyword hoặc ngoài giờ. Khi khách nhắn mới (webhook), hệ thống gửi nội dung khớp (keyword ưu tiên), tôn trọng cooldown. |
| **Luồng chính:** | 1. Cài đặt → Trả lời tự động → thêm rule.<br>2. Khách nhắn inbound.<br>3. Hệ thống chọn rule → gửi qua kênh → lưu tin shop. |
| **Ngoại lệ:** | Cooldown; không khớp; sync lịch sử (`skipAutoReply`); gửi kênh lỗi (log, không fail ingest). |
| **Code:** | `src/lib/auto-reply.ts`, `src/backend/auto-reply.ts`, `AutoReplyManager.tsx` |
