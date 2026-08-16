# Checklist biến môi trường (local)

Sao chép `.env.example` → `.env` (đã có sẵn nếu agent đã cấu hình). **Không commit** file `.env`.

Sau mỗi lần sửa `.env`, **restart** `npm run dev` để Next.js đọc lại biến.

## Đã tự điền (local)

| Biến | Giá trị local |
|------|----------------|
| `DATABASE_URL` | Postgres `127.0.0.1:5432/shopinbox` |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên mạnh |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (ngrok/production: domain HTTPS) |
| `META_REDIRECT_URI` | Tuỳ chọn — trống thì = `{NEXT_PUBLIC_APP_URL}/api/connect/meta/callback` |
| `META_WEBHOOK_VERIFY_TOKEN` | Chuỗi ngẫu nhiên (dùng khi verify webhook) |
| `ZALO_REDIRECT_URI` | Tuỳ chọn — trống thì = `{NEXT_PUBLIC_APP_URL}/api/connect/zalo/callback` |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/google/callback` |

## Bạn phải dán thủ công (từ developer console)

OAuth **không hoạt động** nếu chỉ để trống hoặc bịa ID/Secret. Lấy giá trị thật từ console tương ứng rồi dán vào `.env`.

### Meta (Facebook Messenger + Instagram)

1. Mở [Meta for Developers](https://developers.facebook.com/) → Create App (Business) → thêm Messenger / Instagram.
2. **Settings → Basic** → copy **App ID**, **App Secret**.
3. **Production (Railway)** — bắt buộc, không thì Facebook báo *"Miền … không được đưa vào miền của ứng dụng"*:
   - **Miền ứng dụng:** `shopinbox-production.up.railway.app`
   - **Nền tảng Website → URL:** `https://shopinbox-production.up.railway.app/`
   - **Facebook Login → Valid OAuth Redirect URIs:**
     ```
     https://shopinbox-production.up.railway.app/api/connect/meta/callback
     ```
4. Local / ngrok: **Facebook Login → Valid OAuth Redirect URIs** → dán đúng
   `{NEXT_PUBLIC_APP_URL}/api/connect/meta/callback` (copy từ **Cài đặt** trong ShopInbox).
5. Webhook: **Messenger → Settings → Webhooks** → Callback URL =
   `{NEXT_PUBLIC_APP_URL}/api/webhooks/meta`, Verify token = `META_WEBHOOK_VERIFY_TOKEN`.
6. Dán vào `.env` / Railway Variables:

```env
META_APP_ID=<App ID từ Meta>
META_APP_SECRET=<App Secret từ Meta>
META_WEBHOOK_VERIFY_TOKEN=<chuỗi bí mật bạn tự đặt>
NEXT_PUBLIC_APP_URL=<http://localhost:3000 hoặc https://ngrok-or-railway>
```

7. Restart `npm run dev` (local) hoặc **Deploy** trên Railway. Nút **Kết nối với Facebook/Instagram** sẽ hết báo thiếu biến.

Chi tiết webhook / ngrok / App Domains: [ket-noi-kenh.md](./ket-noi-kenh.md).

### Zalo OA

1. Mở [Zalo Developers](https://developers.zalo.me/) → tạo app → liên kết Official Account.
2. Copy **App ID**, **App Secret**.
3. Đăng ký Redirect URI khớp `ZALO_REDIRECT_URI`.
4. Dán vào `.env`:

```env
ZALO_APP_ID=<App ID từ Zalo>
ZALO_APP_SECRET=<App Secret từ Zalo>
```

5. Restart `npm run dev`.

### Google Sign-In

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth client (Web) → Authorized redirect URI = `GOOGLE_REDIRECT_URI`.
2. Dán vào `.env`:

```env
GOOGLE_CLIENT_ID=<Client ID>
GOOGLE_CLIENT_SECRET=<Client Secret>
```

3. Restart `npm run dev`. Nút đăng nhập Google trên `/login` sẽ bật.

Chi tiết: [dang-nhap-google.md](./dang-nhap-google.md).

## Kiểm tra nhanh

| Tính năng | Biến còn thiếu thì… |
|-----------|---------------------|
| Kết nối FB/IG | `META_APP_ID`, `META_APP_SECRET` |
| Kết nối Zalo | `ZALO_APP_ID`, `ZALO_APP_SECRET` |
| Đăng nhập Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
