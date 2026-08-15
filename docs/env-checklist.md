# Checklist biến môi trường (local)

Sao chép `.env.example` → `.env` (đã có sẵn nếu agent đã cấu hình). **Không commit** file `.env`.

Sau mỗi lần sửa `.env`, **restart** `npm run dev` để Next.js đọc lại biến.

## Đã tự điền (local)

| Biến | Giá trị local |
|------|----------------|
| `DATABASE_URL` | Postgres `127.0.0.1:5432/shopinbox` |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên mạnh |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `META_REDIRECT_URI` | `http://localhost:3000/api/connect/meta/callback` |
| `META_WEBHOOK_VERIFY_TOKEN` | Chuỗi ngẫu nhiên (dùng khi verify webhook) |
| `ZALO_REDIRECT_URI` | `http://localhost:3000/api/connect/zalo/callback` |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/google/callback` |

## Bạn phải dán thủ công (từ developer console)

OAuth **không hoạt động** nếu chỉ để trống hoặc bịa ID/Secret. Lấy giá trị thật từ console tương ứng rồi dán vào `.env`.

### Meta (Facebook Messenger + Instagram)

1. Mở [Meta for Developers](https://developers.facebook.com/) → Create App (Business) → thêm Messenger / Instagram.
2. **Settings → Basic** → copy **App ID**, **App Secret**.
3. **Facebook Login → Settings → Valid OAuth Redirect URIs** → thêm đúng `META_REDIRECT_URI` (local hoặc URL ngrok HTTPS).
4. Dán vào `.env`:

```env
META_APP_ID=<App ID từ Meta>
META_APP_SECRET=<App Secret từ Meta>
```

5. Restart `npm run dev`. Nút **Kết nối với Facebook/Instagram** sẽ hết báo thiếu biến.

Chi tiết webhook / ngrok: [ket-noi-kenh.md](./ket-noi-kenh.md).

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
