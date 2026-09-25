# Danh mục Use Case — ShopInbox

Cập nhật: 15/09/2026

Danh sách use case ở mức mục tiêu người dùng (một người, một phiên, một mục tiêu). Chi tiết từng UC viết file riêng khi đến lượt làm.

Quy ước đặt tên: **động từ + đối tượng** (ví dụ: “Kết nối Fanpage Facebook”).

Diễn viên chính: **Chủ shop**, **Nhân viên**. Hệ thống ngoài: Meta, Zalo (sau).

---

## Nhóm Inbox

| Mã | Tên | Actor | Ưu tiên | Ghi chú |
|----|-----|-------|---------|---------|
| UC-INBOX-01 | Xem và lọc hộp thư chung | Nhân viên | Cao | Đã có; chỉ hiện kênh `ready` (`inbox-visibility`) |
| UC-INBOX-02 | Trả lời hội thoại bằng chữ / media | Nhân viên | Cao | Chữ + ảnh Meta; outbound video/file chưa; Zalo ảnh chưa |
| UC-INBOX-03 | Nhận và nhả quyền trả lời hội thoại | Nhân viên | Cao | Claim theo TTL shop |

## Nhóm mẫu tin & tự động

| Mã | Tên | Actor | Ưu tiên | Ghi chú |
|----|-----|-------|---------|---------|
| UC-TMPL-01 | Quản lý mẫu tin nhắn | Chủ shop | Cao | [UC-TMPL-01…](./UC-TMPL-01_quan-ly-mau-tin.md) — CRUD trên Cài đặt |
| UC-TMPL-02 | Chèn mẫu tin khi trả lời | Nhân viên | Cao | Đã có chip trong composer |
| UC-AUTO-01 | Cấu hình trả lời tự động (ngoài giờ / từ khóa) | Chủ shop | Trung bình | [UC-AUTO-01…](./UC-AUTO-01_tra-loi-tu-dong.md) — CRUD trên Cài đặt + engine inbound |

## Nhóm media

| Mã | Tên | Actor | Ưu tiên | Ghi chú |
|----|-----|-------|---------|---------|
| UC-MEDIA-01 | Gửi ảnh / video / file trong hội thoại | Nhân viên | Cao | Inbound Meta ảnh/video/audio/file; outbound ảnh Meta (+ validate 5MB); Zalo ảnh outbound chưa |

## Nhóm đơn hàng

| Mã | Tên | Actor | Ưu tiên | Ghi chú |
|----|-----|-------|---------|---------|
| UC-ORD-01 | Tạo đơn từ hội thoại | Nhân viên | Cao | Đã có |
| UC-ORD-02 | Gộp đơn liên quan của cùng khách | Nhân viên | Trung bình | Đã có: trang Đơn → gộp mọi đơn «Mới» cùng khách vào đơn cũ nhất |
| UC-ORD-03 | Cập nhật trạng thái đơn | Nhân viên | Cao | Đã có |
| UC-ORD-04 | Checklist vận hành trên đơn (tick thủ công + audit) | Nhân viên | Trung bình | Đã có: cấu hình Cài đặt; tick trang Đơn |
| UC-PRD-01 | Quản lý kho sản phẩm (CRUD) | Nhân viên | Cao | Đã có: trang Sản phẩm |

## Nhóm khách hàng

| Mã | Tên | Actor | Ưu tiên | Ghi chú |
|----|-----|-------|---------|---------|
| UC-CUS-01 | Xem và sửa hồ sơ khách | Nhân viên | Cao | Đã có (trang Khách + form trong Inbox) |
| UC-CUS-02 | Gộp hồ sơ khách trùng giữa các kênh | Chủ shop | Trung bình | Đã có: trang Khách → chọn giữ / gộp; identity trùng kênh giữ bản đích |

## Nhóm kênh kết nối

| Mã | Tên | Actor | Ưu tiên | Ghi chú |
|----|-----|-------|---------|---------|
| UC-CH-01 | Kết nối Facebook / Instagram | Chủ shop | Cao | Spec: [UC-CH-01…](./UC-CH-01_ket-noi-facebook-instagram.md) · hướng dẫn: [ket-noi-meta…](./ket-noi-meta-fb-ig.md) |
| UC-CH-02 | Ngắt kết nối kênh (ẩn hội thoại khỏi Inbox) | Chủ shop | Cao | Đã có: `disconnectChannel` + `inbox-visibility` |
| UC-CH-03 | Đồng bộ lại tin Meta gần đây | Chủ shop | Trung bình | Đã có nút «Đồng bộ tin nhắn» trên Cài đặt |
| UC-CH-04 | Kết nối Zalo OA | Chủ shop | Thấp (lúc này) | OAuth + chữ OK; media / ký webhook chưa — sau Meta |
| UC-CH-05 | Chẩn đoán lỗi webhook / OAuth | Chủ shop | Cao | `oauth-flash` + note kênh + docs troubleshooting |

## Nhóm đội ngũ

| Mã | Tên | Actor | Ưu tiên | Ghi chú |
|----|-----|-------|---------|---------|
| UC-TEAM-01 | Quản lý nhân viên và quyền | Chủ shop | Trung bình | Đã có nền RBAC |

---

## Thứ tự viết chi tiết / implement

1. UC-CH-01, UC-CH-02, UC-CH-05 (kết nối Meta ổn)
2. Ổn định UC-INBOX-01 (visibility)
3. UC-TMPL-01 → UC-MEDIA-01 → UC-AUTO-01
4. UC-ORD-02, UC-CUS-02
5. UC-CH-04 rồi kênh mới

Khi bắt đầu một UC: copy khung 13 mục (như file UC-CH-01), điền Normal Course / AC / Exception trước khi code.
