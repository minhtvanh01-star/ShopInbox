# Tiện ích Chrome — Chat website

Gắn thử nút Chat Nexo lên **website đang mở**. Không dùng cho Facebook / Zalo.

Khách vào site trên máy khác **không** thấy nút nếu chưa dán snippet vào HTML / theme.

## Cài (unpacked)

1. Chrome → `chrome://extensions` → bật **Developer mode**.
2. **Load unpacked** → chọn thư mục `extensions/web-widget`.
3. ShopInbox → **Cài đặt → Chat website**: lưu domain, **Gửi sang tiện ích Chrome**.
4. Bấm icon Nexo trên **đúng tab Cài đặt** → **Xác nhận gắn ShopInbox này**.
5. Mở đúng website đó → bấm icon tiện ích → **Hiện nút Chat trên trang này**.
6. **Copy snippet** rồi dán trước `</body>` (hoặc `theme.liquid`) để khách thật thấy chat.

Tiện ích không lắng nghe `postMessage` từ mọi trang. Chỉ đọc marker trên tab Cài đặt khi bạn mở popup.

**Nối domain trang này** mở Cài đặt với host tab đang xem — lưu rồi gửi lại tiện ích.
