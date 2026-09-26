# Hướng dẫn kết nối kênh (OAuth)

ShopInbox hỗ trợ **kết nối OAuth** cho Facebook Messenger, Instagram DM và Zalo OA. Chủ shop (quyền `channels.connect`) vào **Cài đặt → Thêm kết nối**, chọn kênh, bấm **Kết nối với Facebook / Instagram / Zalo** — không cần dán App Secret trên giao diện.

Nếu shop chưa có dòng `channel_accounts` cho kênh đó, nút OAuth vẫn hiện; lần bấm đầu server sẽ tạo nháp kênh. Nút chỉ hoạt động khi `.env` đã đủ biến Meta/Zalo (xem mục dưới và `.env.example`); thiếu biến thì nút bị khóa và liệt kê tên biến còn thiếu.

Checklist nhanh (local + biến phải dán thủ công): [env-checklist.md](./env-checklist.md).

## Tổng quan

| Kênh | OAuth | Webhook HTTPS | Ghi chú |
|------|-------|---------------|---------|
| Facebook Messenger | Có (Meta) | Có | Một Meta app cho cả FB + IG |
| Instagram DM | Có (Meta) | Có | Page phải liên kết IG Business |
| Zalo OA | Có (Zalo) | Có | OA phải liên kết app Developers |
| Chat website | Không | Widget HTTPS | Domain + snippet `/widget.js` |

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

Cập nhật `.env` (chỉ cần `NEXT_PUBLIC_APP_URL` — redirect OAuth được suy tự động nếu `META_REDIRECT_URI` / `ZALO_REDIRECT_URI` trống):

```env
NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app
# Tuỳ chọn — nếu trống app dùng NEXT_PUBLIC_APP_URL + path callback
# META_REDIRECT_URI=https://abc123.ngrok-free.app/api/connect/meta/callback
# ZALO_REDIRECT_URI=https://abc123.ngrok-free.app/api/connect/zalo/callback
```

URL cố định (copy từ **Cài đặt** trong app cũng được):

| Mục | Path |
|-----|------|
| Meta OAuth callback | `{APP_URL}/api/connect/meta/callback` |
| Meta Webhook | `{APP_URL}/api/webhooks/meta` |
| Zalo OAuth callback | `{APP_URL}/api/connect/zalo/callback` |
| Zalo Webhook | `{APP_URL}/api/webhooks/zalo` |

---

## 1. Meta (Facebook + Instagram)

> Hướng dẫn chi tiết + checklist + bảng lỗi (nên đọc khi đang bí kết nối): [ket-noi-meta-fb-ig.md](./ket-noi-meta-fb-ig.md).  
> Use case: [UC-CH-01_ket-noi-facebook-instagram.md](./UC-CH-01_ket-noi-facebook-instagram.md).  
> Yêu cầu tổng: [yeu-cau-he-thong.md](./yeu-cau-he-thong.md).

### Tạo Meta Developer app

1. [Meta for Developers](https://developers.facebook.com/) → **Create App** (Business).
2. Thêm **Messenger** và **Instagram** messaging.
3. **Settings → Basic**: copy **App ID**, **App Secret**.

### Miền ứng dụng + Redirect (bắt buộc trên production)

Lỗi Facebook *"Miền của URL này không được đưa vào miền của ứng dụng"* = chưa khai báo hostname production trên Meta.

Trên app Meta → **Cài đặt ứng dụng → Thông tin cơ bản**:

1. **Miền ứng dụng (App Domains)** — thêm (không có `https://`):
   ```
   <hostname-production>
   ```
   Ví dụ: `app.example.com` hoặc subdomain host bạn đang dùng.
2. **Thêm nền tảng → Website** (nếu chưa có) → **URL trang web**:
   ```
   https://<hostname-production>/
   ```
3. Bấm **Lưu thay đổi**.

### Redirect URI (OAuth)

Trong app Meta → **Đăng nhập bằng Facebook → Cài đặt → Valid OAuth Redirect URIs**:

```
https://<hostname-production>/api/connect/meta/callback
```

Local qua ngrok: dùng URL ngrok tương ứng (và thêm miền ngrok vào App Domains nếu Meta yêu cầu).

### Biến môi trường server

```env
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=chuoi-bi-mat-tuy-chon
NEXT_PUBLIC_APP_URL=https://<hostname-production>
# META_REDIRECT_URI tuỳ chọn — nếu trống hoặc còn localhost, app suy từ NEXT_PUBLIC_APP_URL
```

`META_WEBHOOK_VERIFY_TOKEN` dùng khi Meta gọi GET verify webhook (`/api/webhooks/meta`).

> Đặt đúng `NEXT_PUBLIC_APP_URL` = domain public HTTPS. Một số host lắng nghe cổng nội bộ (vd. `8080`) — code suy OAuth callback / webhook từ URL public (tránh nhảy `localhost`).

### Webhook tin nhắn

1. **Messenger → Settings → Webhooks** → Callback URL: `https://your-domain/api/webhooks/meta`
2. Verify token = `META_WEBHOOK_VERIFY_TOKEN`
3. Subscribe: `messages`, `messaging_postbacks`, …

### Quyền OAuth (scopes)

Facebook / Instagram (qua Fanpage) xin quyền Page:

- `pages_show_list`
- `pages_messaging`
- `pages_manage_metadata`

Không xin `instagram_basic` / `instagram_manage_messages` (Meta báo **Invalid Scopes** trên nhiều app). Instagram DM vẫn nối qua Page đã liên kết IG Business.

Production cần **App Review** trước khi go-live cho khách ngoài tester.

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

Không OAuth, không App Review. Trong **Cài đặt → Chat website**:

1. Dán **link website** (đúng host gắn widget, ví dụ `https://cuahang.vn`).
2. Bấm **Kiểm tra website** — server đọc HTML công khai (chặn localhost/IP nội bộ). Báo nếu đã có snippet ShopInbox hoặc chat khác (Tawk, Crisp, …).
3. **Lưu & kết nối** — hệ thống tạo widget key và snippet.
4. Dán snippet trước thẻ đóng `</body>`. Có thể **Thử chat tại đây** (`/settings/web-preview`) rồi kiểm tra lại site.

```html
<script src="https://<APP_URL>/widget.js" data-key="siwk_..." async></script>
```

Khách nhắn trên widget → Inbox kênh `web`. Shop trả lời trong Inbox; widget poll tin shop (không cần SSE).

- CORS chỉ cho đúng host đã lưu. Key nằm trong HTML (public) — **Đổi widget key** nếu lộ / đổi site.
- Theme Shopify: dán snippet như website thường (không phải Shopify Inbox API).

### Shopify: hai lớp, không gộp

| Lớp | Kênh Inbox | Trạng thái |
|-----|------------|------------|
| Theme nhúng widget | `web` | Đã có — dán snippet vào `theme.liquid` / App embed |
| Shopify Inbox / Messaging API | `shopify` (chưa thêm enum) | Sắp có — cần Partner app, OAuth riêng, GDPR webhook |

Không có nút «Kết nối Shopify». Inbox native + đơn Shopify cùng thread chỉ làm khi có khách Shopify thật và chấp nhận duyệt app.

### WhatsApp Cloud API (pha 3)

Cùng họ Meta với Facebook/Instagram. **Chưa mở kết nối.** Điều kiện: Business Verification + app Meta Live + App Review `whatsapp_business_messaging` + số Cloud API. Làm sau khi FB/IG Live ổn — không thêm enum/`oauth` giả trước đó.

### TikTok Messaging (pha 4)

Cần đối tác TikTok For Business / Messaging. UI giữ **Sắp có**. Không có `Channel.tiktok` và không có OAuth giả cho đến khi có quyền API.

---

## 4. Cấu hình nâng cao (dev)

Modal có mục **Cấu hình nâng cao (dev)** để dán App ID / Secret thủ công khi chưa có OAuth app — **không dùng production**.

---

## 5. Bảo mật

- `META_APP_SECRET` / `ZALO_APP_SECRET` chỉ trên server (`.env`). Page/OA **access token** chỉ trong DB — **không** serialize xuống RSC/client.
- Form «Cấu hình nâng cao (dev)» có thể *ghi* secret mới; UI **không** đọc lại giá trị đã lưu (chỉ hiện placeholder «đã lưu»).
- `META_WEBHOOK_VERIFY_TOKEN` được hiện trên Cài đặt cho người có `channels.connect` để copy sang Meta (cố ý phục vụ setup).
- Webhook Meta POST bắt buộc `X-Hub-Signature-256` khớp App Secret. Webhook Zalo hiện **chưa** ký (hạn chế đã biết).
- Access token trong DB: plaintext — mã hóa at-rest là nâng cấp sau.
- OAuth dùng `state` JWT + cookie CSRF (~15 phút).
- Chỉ session có quyền `channels.connect` gọi `/api/connect/*`.

---

## 6. Checklist go-live

- [ ] HTTPS production (hoặc ngrok khi dev)
- [ ] Redirect URI khớp chính xác trong Meta/Zalo
- [ ] Webhook verify thành công
- [ ] App Meta/Zalo ở chế độ **Live**
- [ ] Chỉ chủ shop kết nối kênh

**Giới hạn hiện tại:**

- **Đồng bộ inbound:** Webhook Meta/Zalo ghi tin vào PostgreSQL. Inbox soft-poll ~8s + `revalidatePath` sau webhook (chưa SSE/WS).
- **Gửi outbound:** Meta chữ + ảnh; Zalo chữ. Kênh web lưu Inbox rồi widget poll tin shop.
- **Dedup:** `external_message_id`; Meta echo (`is_echo`) bỏ qua inbound.
- **Zalo media / ký webhook:** chưa.

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
