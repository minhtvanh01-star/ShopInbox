# Hướng dẫn kết nối kênh (OAuth)

ShopInbox hỗ trợ **kết nối OAuth** cho Facebook Messenger, Instagram DM và Zalo OA. Chủ shop (quyền `channels.connect`) vào **Cài đặt → Thêm kết nối**, chọn kênh, bấm **Kết nối với Facebook / Instagram / Zalo** — không cần dán App Secret trên giao diện.

Nếu shop chưa có dòng `channel_accounts` cho kênh đó, nút OAuth vẫn hiện; lần bấm đầu server sẽ tạo nháp kênh. Nút chỉ hoạt động khi `.env` đã đủ biến Meta/Zalo (xem mục dưới và `.env.example`); thiếu biến thì nút bị khóa và liệt kê tên biến còn thiếu.

## Tổng quan

| Kênh | OAuth | Webhook HTTPS | Ghi chú |
|------|-------|---------------|---------|
| Facebook Messenger | Có (Meta) | Có | Một Meta app cho cả FB + IG |
| Instagram DM | Có (Meta) | Có | Page phải liên kết IG Business |
| Zalo OA | Có (Zalo) | Có | OA phải liên kết app Developers |
| Chat website | Không | Khuyến nghị | Domain + widget key thủ công |

## Luồng OAuth trong app

1. Chủ shop bấm **Kết nối với Facebook / Zalo** → redirect sang Meta/Zalo.
2. Sau khi cấp quyền, callback `/api/connect/meta/callback` hoặc `/api/connect/zalo/callback` lưu token vào PostgreSQL (`channel_accounts.accessToken`).
3. Nếu Meta có nhiều Fanpage → modal **Chọn trang để kích hoạt**.
4. Trạng thái kênh: **Chưa nối** → **Đang kết nối** → **Đã nối** (hiện tên Page/OA).
5. Dán **Webhook URL** (hiện trong modal sau khi nối) vào Meta / Zalo Developers.

**Local dev:** Meta và Zalo yêu cầu redirect URI và webhook **HTTPS công khai**. Dùng [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Cập nhật `.env`:

```env
NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app
META_REDIRECT_URI=https://abc123.ngrok-free.app/api/connect/meta/callback
ZALO_REDIRECT_URI=https://abc123.ngrok-free.app/api/connect/zalo/callback
```

Webhook:

- Meta: `https://your-domain/api/webhooks/meta`
- Zalo: `https://your-domain/api/webhooks/zalo`

---

## 1. Meta (Facebook + Instagram)

### Tạo Meta Developer app

1. [Meta for Developers](https://developers.facebook.com/) → **Create App** (Business).
2. Thêm **Messenger** và **Instagram** messaging.
3. **Settings → Basic**: copy **App ID**, **App Secret**.

### Redirect URI (OAuth)

Trong app Meta → **Facebook Login → Settings → Valid OAuth Redirect URIs**:

```
https://your-domain/api/connect/meta/callback
```

Local qua ngrok: dùng URL ngrok tương ứng.

### Biến môi trường server

```env
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://your-domain/api/connect/meta/callback
META_WEBHOOK_VERIFY_TOKEN=chuoi-bi-mat-tuy-chon
NEXT_PUBLIC_APP_URL=https://your-domain
```

`META_WEBHOOK_VERIFY_TOKEN` dùng khi Meta gọi GET verify webhook (`/api/webhooks/meta`).

### Webhook tin nhắn

1. **Messenger → Settings → Webhooks** → Callback URL: `https://your-domain/api/webhooks/meta`
2. Verify token = `META_WEBHOOK_VERIFY_TOKEN`
3. Subscribe: `messages`, `messaging_postbacks`, …

### Quyền OAuth (scopes)

App yêu cầu: `pages_show_list`, `pages_messaging`, `pages_manage_metadata`, `instagram_basic`, `instagram_manage_messages`.

Production cần **App Review** trước khi go-live.

Tài liệu: [Messenger Platform](https://developers.facebook.com/docs/messenger-platform/), [Instagram Messaging](https://developers.facebook.com/docs/messenger-platform/instagram).

---

## 2. Zalo OA

### Tạo app Zalo Developers

1. [Zalo Developers](https://developers.zalo.me/) → tạo app OA, liên kết Official Account.
2. Lấy **App ID**, **Secret Key**.

### Callback OAuth

Trong app Zalo → cấu hình **Redirect URI**:

```
https://your-domain/api/connect/zalo/callback
```

### Biến môi trường

```env
ZALO_APP_ID=
ZALO_APP_SECRET=
ZALO_REDIRECT_URI=https://your-domain/api/connect/zalo/callback
NEXT_PUBLIC_APP_URL=https://your-domain
```

### Webhook

URL: `https://your-domain/api/webhooks/zalo` — bật sự kiện tin nhắn trong trang quản trị OA.

Tài liệu: [Zalo OA API](https://developers.zalo.me/docs/official-account/bat-dau/gioi-thieu-oa-api).

---

## 3. Chat website

Không OAuth. Trong modal **Chat website**:

- **Domain website** — URL site gắn widget
- **Widget key** (tùy chọn) — khóa nội bộ

---

## 4. Cấu hình nâng cao (dev)

Modal có mục **Cấu hình nâng cao (dev)** để dán App ID / Secret thủ công khi chưa có OAuth app — **không dùng production**.

---

## 5. Bảo mật

- App Secret chỉ trên server (`.env`), không gửi xuống client.
- Access token lưu trong `channel_accounts` — mã hóa at-rest là nâng cấp sau.
- OAuth dùng `state` JWT + cookie CSRF (15 phút).
- Chỉ role **owner** gọi `/api/connect/*`.

---

## 6. Checklist go-live

- [ ] HTTPS production (hoặc ngrok khi dev)
- [ ] Redirect URI khớp chính xác trong Meta/Zalo
- [ ] Webhook verify thành công
- [ ] App Meta/Zalo ở chế độ **Live**
- [ ] Chỉ chủ shop kết nối kênh

**Giới hạn hiện tại (Lát 4+):**

- **Đồng bộ inbound:** Webhook Meta/Zalo ghi tin nhắn khách vào PostgreSQL → hiện trong Inbox khi tải/trang refresh (`revalidatePath` sau webhook).
- **Gửi outbound:** Inbox gọi Meta Graph Send API / Zalo OA send khi kênh `ready` + có token; lưu `external_message_id` để dedup với webhook echo. Kênh web / demo (chưa OAuth) vẫn chỉ ghi DB.
- **Dedup:** `external_message_id` (mid/msg_id) tránh ghi trùng; Meta echo (`is_echo`) bỏ qua inbound.

---

## 7. Đồng bộ tin nhắn (webhook → Inbox)

### Luồng tự động

1. Khách nhắn Fanpage / IG / Zalo OA.
2. Meta/Zalo gọi POST webhook (`/api/webhooks/meta` hoặc `/api/webhooks/zalo`).
3. Server tìm `channel_accounts` theo `pageId` / `oaId`, tạo `Customer` + `Conversation` nếu chưa có, ghi `Message` (sender = customer).
4. Cập nhật `last_webhook_at` trên kênh — UI hiện checklist &quot;Tin nhắn đã đồng bộ&quot;.
5. Inbox refresh (F5 hoặc điều hướng lại) thấy hội thoại mới.

### Tự cấu hình vs thủ công

| Bước | Tự động trong app | Thủ công (dashboard) |
|------|-------------------|----------------------|
| OAuth + lưu token | ✓ | — |
| Hiện Webhook URL + Verify token (copy) | ✓ | — |
| Facebook: `subscribed_apps` sau OAuth | ✓ thử tự gọi | Meta Developers nếu thất bại |
| Instagram webhook | — | Đăng ký app webhook + subscribe Page liên kết IG |
| Zalo webhook URL | ✓ hiện URL | Zalo OA Admin → Webhook |
| Verify token Meta | ✓ dùng `META_WEBHOOK_VERIFY_TOKEN` | Nhập cùng giá trị khi verify |

### Test end-to-end (local + ngrok)

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000
```

1. Cập nhật `.env` với URL ngrok (`NEXT_PUBLIC_APP_URL`, redirect URIs).
2. Chủ shop: **Cài đặt → Kết nối** OAuth Facebook/Zalo.
3. Copy webhook URL từ modal → dán Meta/Zalo Developers, verify token = `META_WEBHOOK_VERIFY_TOKEN`.
4. Nhắn thử từ tài khoản khách → mở **Inbox**, refresh nếu cần.
5. **Cài đặt** hiện &quot;Webhook gần nhất&quot; khi nhận event.

### Migration mới (nếu chưa chạy)

```bash
npm run db:migrate
```

Thêm cột: `messages.external_message_id`, `channel_accounts.connected_at`, `channel_accounts.last_webhook_at`.
