# Yêu cầu hệ thống ShopInbox

Cập nhật: 15/09/2026 (rà docs ↔ code)

Tài liệu này ghi lại ShopInbox cần làm gì, cái gì đã có, cái gì còn thiếu, và thứ tự làm. Viết để dev / BA / chủ shop cùng đọc được. Không lấy mã hay giao diện từ phần mềm thương mại khác.

---

## ShopInbox làm gì?

Shop bán hàng trên Facebook / Instagram (sau này thêm Zalo và kênh khác). Nhân viên đang phải nhảy app để trả lời và chốt đơn. ShopInbox gom hội thoại vào một chỗ: đọc tin, trả lời (kèm ảnh), dùng mẫu tin, tạo đơn, xem khách, quản lý kênh đã nối.

Ưu tiên lúc này theo chủ shop:

1. Hệ thống chạy ổn.
2. Kết nối Facebook / Instagram dùng được thật (đây là chỗ đang đau nhất).
3. Rồi mới thêm tính năng còn thiếu.
4. Zalo, X, Telegram, TikTok để sau.

---

## Quy ước khi làm

- Không copy code / UI sản phẩm khác. Có thể đọc tài liệu công khai (Meta, Zalo…) để hiểu API, rồi tự viết trên repo này.
- Meta (FB + IG) trước. Zalo và kênh còn lại sau.
- Go-live Meta (HTTPS + App Domains + webhook thật) vẫn là cổng; tính năng D đã có trong code nhưng chưa thay thế bước C.
- Mỗi lần xong một phần: chạy `npm test` và `npx tsc --noEmit`. UI thì thêm lint file đã sửa.
- Đổi nghiệp vụ hoặc luồng kết nối thì cập nhật docs cho khớp.

---

## Ai dùng hệ thống?

| Vai | Việc chính |
|-----|------------|
| Chủ shop (admin) | Nối kênh, cấu hình shop, quản lý nhân viên, quyền |
| Nhân viên | Inbox, trả lời, tạo / đổi đơn, sửa thông tin khách (theo quyền) |
| Khách | Nhắn qua FB / IG /… — không vào ShopInbox |
| Meta | OAuth, Graph API, webhook |
| Zalo (sau) | OAuth OA, webhook |

Chi tiết quyền: [phan-quyen.md](./phan-quyen.md).

---

## Hiện trạng theo module (15/09/2026)

| Phần | Việc nghiệp vụ | Tình trạng **code** | Ghi chú |
|------|----------------|---------------------|---------|
| Đăng nhập / quyền | Login, Google, OTP, RBAC | Đã có | — |
| Inbox | Hội thoại, claim, tag, reaction, receipt, soft poll ~8s | Đã có | Ngắt kênh → ẩn hội thoại (`inbox-visibility`) |
| FB / IG | OAuth, chọn Page, webhook (+ chữ ký `X-Hub-Signature-256`), gửi/nhận chữ + ảnh | Code sẵn | **Go-live thật còn phụ thuộc** Meta App + HTTPS của shop |
| Zalo | OAuth + gửi/nhận chữ | Có nền | Webhook chưa ký; ảnh outbound chưa; xếp sau Meta |
| Mẫu tin | Quick reply | Đã có | Cài đặt + chip Inbox |
| Trả lời tự động | Ngoài giờ / từ khóa | Đã có | Engine sau inbound |
| Media | Ảnh / video / file | Một phần | Inbound Meta đủ loại; outbound ảnh Meta; Zalo media chưa |
| Đơn hàng | Tạo, đổi TT, gộp «Mới», checklist tick | Đã có | Checklist cấu hình ở Cài đặt; tick trên trang Đơn + audit |
| Sản phẩm / kho | CRUD tên–giá–SKU–còn hàng | Đã có | Trang `/products`; dùng khi tạo đơn Inbox |
| Khách hàng | Hồ sơ, gộp trùng | Đã có | Trang Khách |
| Nhân viên / nhật ký | Staff, audit | Đã có | — |
| X / Tele / TikTok… | — | Stub catalog | Chưa làm |

### Đánh giá mức hoàn thiện (nhìn ops + product)

| Lớp | Ước lượng | Ý nghĩa |
|-----|-----------|---------|
| Product CRUD / Inbox nội bộ | ~80–85% | Đủ dùng nội bộ nếu đã có data / kênh demo |
| Meta end-to-end production | ~55–65% | Code có; checklist HTTPS/App Review/Roles **chưa tick được trong repo** |
| Zalo production | ~35–45% | Text OK; media + xác thực webhook còn thiếu |
| Bảo mật production-ready | ~60–70% | Webhook Meta đã verify chữ ký; secret kênh không còn xuống client; token at-rest vẫn plaintext; Zalo webhook mở |
| Đa kênh (X/Tele/…) | ~5% | Chỉ stub UI |

**Kết luận ngắn:** Không còn “feature D bị bỏ quên” trong phạm vi đã thống nhất — nhưng **chưa** gọi là hệ thống mang ra bán / dùng Live với khách thật cho đến khi mục C (checklist Meta) xanh trên domain HTTPS của shop.

---

## Yêu cầu kỹ thuật cần giữ

- App Secret / Page access token chỉ nằm server (`.env` / DB). UI Settings **không** serialize `appSecret` / `webhookSecret` xuống trình duyệt (chỉ cờ đã lưu).
- `META_WEBHOOK_VERIFY_TOKEN` có thể hiện trên Cài đặt cho người có `channels.connect` để copy sang Meta (cố ý phục vụ setup).
- Webhook Meta: GET verify bằng verify token; POST phải khớp `X-Hub-Signature-256` với `META_APP_SECRET`.
- Tin lưu có `external_message_id` để khỏi ghi trùng.
- Local muốn OAuth / webhook Meta chạy được thì cần HTTPS public (thường dùng ngrok).
- Production: `NEXT_PUBLIC_APP_URL` phải đúng domain đang chạy; App Domains trên Meta cũng phải khớp.
- Việc nối / ngắt kênh quan trọng nên có audit (đã có).

---

## Thứ tự làm (đã thống nhất)

### A. Tài liệu

- File yêu cầu này
- Danh mục use case: [uc-danh-muc.md](./uc-danh-muc.md)
- Use case nối Meta: [UC-CH-01_ket-noi-facebook-instagram.md](./UC-CH-01_ket-noi-facebook-instagram.md)
- Hướng dẫn nối FB/IG + xử lý lỗi: [ket-noi-meta-fb-ig.md](./ket-noi-meta-fb-ig.md)

### B. Ổn định cho chạy được

1. [x] Rà ẩn hội thoại khi ngắt kênh (`inbox-visibility`)
2. [x] `npm test` + `tsc` xanh sau các vá B1/B2
3. [ ] Đi hết checklist trong [ket-noi-meta-fb-ig.md](./ket-noi-meta-fb-ig.md) trên môi trường HTTPS thật (**chủ shop / ops**)
4. [x] Thông báo lỗi OAuth rõ hơn; confirm ngắt kênh nêu rõ ẩn Inbox; link docs Meta trên Cài đặt

### C. Meta dùng được thật (ưu tiên cao nhất)

1. [x] OAuth FB/IG + DX lỗi + note khi sync/webhook fail
2. [x] Webhook: inbound media; POST có verify chữ ký
3. [x] Gửi chữ + ảnh; cửa sổ 24h (FB Human Agent / IG không HA); banner composer
4. [ ] Chủ shop tick checklist go-live trên HTTPS thật

### D. Tính năng sản phẩm (đã làm trong code; vẫn phụ thuộc C để “thật”)

1. [x] Quản lý mẫu tin (`UC-TMPL-01`)
2. [~] Media (inbound Meta OK; outbound ảnh Meta; Zalo ảnh chưa)
3. [x] Auto-reply hẹp (`UC-AUTO-01`)
4. [x] Gộp đơn «Mới» / gộp khách (`UC-ORD-02`, `UC-CUS-02`)
5. [~] Panel khách + đơn Inbox (đã có; gộp đơn «Mới» trên panel)

### E. Mở rộng kênh

Zalo làm chắc (ký webhook + media) → rồi mới nghiên cứu X / Telegram / TikTok (viết docs riêng trước khi code).

---

## Khi nào coi là “mang ra dùng” được?

Trên domain HTTPS thật (không chỉ localhost):

1. Admin nối được Facebook và/hoặc Instagram, trạng thái **Đã nối**.
2. Nick tester nhắn vào Page / IG → Inbox thấy tin (soft poll ~8s hoặc refresh).
3. Nhân viên trả lời chữ hoặc ảnh → khách nhận trên Messenger / IG.
4. Tạo đơn từ hội thoại và đổi trạng thái ở trang Đơn hàng.
5. Ngắt kênh → hội thoại kênh đó biến mất khỏi Inbox (data vẫn giữ trong DB).

Năm mục này xanh thì mới coi Meta MVP sẵn sàng vận hành.

---

## File liên quan

| File | Đọc khi nào |
|------|-------------|
| [uc-danh-muc.md](./uc-danh-muc.md) | Muốn xem toàn bộ use case |
| [UC-CH-01_ket-noi-facebook-instagram.md](./UC-CH-01_ket-noi-facebook-instagram.md) | Spec nối FB/IG |
| [ket-noi-meta-fb-ig.md](./ket-noi-meta-fb-ig.md) | Làm OAuth / webhook / sửa lỗi kết nối |
| [ket-noi-kenh.md](./ket-noi-kenh.md) | Tổng quan kênh (gồm Zalo) |
| [env-checklist.md](./env-checklist.md) | Điền biến `.env` |
| [phan-quyen.md](./phan-quyen.md) | Role / permission |
| [dang-nhap-google.md](./dang-nhap-google.md) | Google login |
| [dang-ky-email-otp.md](./dang-ky-email-otp.md) | Đăng ký OTP |
