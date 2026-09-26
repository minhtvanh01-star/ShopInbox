# Checklist biến môi trường (local)

Sao chép `.env.example` → `.env` (đã có sẵn nếu agent đã cấu hình). **Không commit** file `.env`.

Sau mỗi lần sửa `.env`, **restart** `npm run dev` để Next.js đọc lại biến.

## Đã tự điền (local)

| Biến | Giá trị local |
|------|----------------|
| `DATABASE_URL` | Postgres `127.0.0.1:5432/shopinbox` |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên mạnh (production ≥ 32 ký tự) |
| `ZALO_WEBHOOK_VERIFY_TOKEN` | Token riêng verify webhook Zalo (không dùng App Secret) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (ngrok/production: domain HTTPS) |
| `FORCE_HTTPS` | Trống = production ép HTTPS. Đặt `0` để tắt redirect |
| `META_REDIRECT_URI` | Tuỳ chọn — trống thì = `{NEXT_PUBLIC_APP_URL}/api/connect/meta/callback` |
| `META_WEBHOOK_VERIFY_TOKEN` | Chuỗi ngẫu nhiên (dùng khi verify webhook) |
| `ZALO_REDIRECT_URI` | Tuỳ chọn — trống thì = `{NEXT_PUBLIC_APP_URL}/api/connect/zalo/callback` |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/google/callback` |

## Bạn phải dán thủ công (từ developer console)

OAuth **không hoạt động** nếu chỉ để trống hoặc bịa ID/Secret. Lấy giá trị thật từ console tương ứng rồi dán vào `.env`.

### Meta (Facebook Messenger + Instagram)

1. Mở [Meta for Developers](https://developers.facebook.com/) → Create App (Business) → thêm Messenger / Instagram.
2. **Settings → Basic** → copy **App ID**, **App Secret**.
3. **Production** — bắt buộc khai báo miền trên Meta (không thì Facebook báo *"Miền … không được đưa vào miền của ứng dụng"*):
   - **Miền ứng dụng:** `<hostname-production>` (không có `https://`)
   - **Nền tảng Website → URL:** `https://<hostname-production>/`
   - **Facebook Login → Valid OAuth Redirect URIs:**
     ```
     https://<hostname-production>/api/connect/meta/callback
     ```
4. Local / ngrok: **Facebook Login → Valid OAuth Redirect URIs** → dán đúng
   `{NEXT_PUBLIC_APP_URL}/api/connect/meta/callback` (copy từ **Cài đặt** trong ShopInbox).
5. Webhook: **Messenger → Settings → Webhooks** → Callback URL =
   `{NEXT_PUBLIC_APP_URL}/api/webhooks/meta`, Verify token = `META_WEBHOOK_VERIFY_TOKEN`.
6. Dán vào `.env` / biến host:

```env
META_APP_ID=<App ID từ Meta>
META_APP_SECRET=<App Secret từ Meta>
META_WEBHOOK_VERIFY_TOKEN=<chuỗi bí mật bạn tự đặt>
NEXT_PUBLIC_APP_URL=<http://localhost:3000 hoặc https://ngrok-or-production>
```

7. Restart `npm run dev` (local) hoặc redeploy host. Nút **Kết nối với Facebook/Instagram** sẽ hết báo thiếu biến.

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
| Backup production | Tự chạy khi `NODE_ENV=production`. Volume: `BACKUP_DIR`. Cron: `CRON_SECRET` |
| Cloudflare | DNS cam + SSL Full (strict) + Bot Fight Mode. `CLOUDFLARE_ONLY=1` khi đã proxy |
| Super admin | `SUPER_ADMIN_EMAIL` = email login của bạn. Chỉ bootstrap khi chưa có Super admin. Vào `/admin/shops` |

## VPS / VibeHost

1. **Tạo cơ sở dữ liệu** trên panel → copy `DATABASE_URL` (Postgres).
2. **Gắn tên miền** (ảnh đang *Chưa gắn*).
3. **Biến môi trường** — dán khối production, **không** chạy `db:seed`.
4. Build: `npm ci && npm run build`. Start: `npm start` (đã gồm `prisma migrate deploy`).
5. Node **≥ 22.12**. RAM 1GB rất chật cho Next + Prisma — theo dõi OOM khi build.
6. Push nhánh `main` đủ code mới; host đang trỏ `github.com/minhtvanh01-star/Shopinbox`.

## Cloudflare + backup (production)

1. Trỏ domain vào Cloudflare, bật **Proxied** (cam). SSL/TLS = **Full (strict)**.
2. **Security → Bots → Bot Fight Mode** (chống bot cơ bản). Error monitoring bạn tự bật trên Cloudflare / host.
3. Đặt `NEXT_PUBLIC_APP_URL=https://<domain-thật>` rồi `CLOUDFLARE_ONLY=1` trên host — request không có `cf-ray` bị 403 (trừ `/api/health`, `/api/cron/`, `/api/webhooks/`).
4. Backup: app ghi `./backups` (hoặc `BACKUP_DIR`) mỗi 24 giờ. Gắn volume nếu host xóa disk khi redeploy. Gọi thủ công: `npm run db:backup` hoặc `Authorization: Bearer $CRON_SECRET` tới `/api/cron/backup`.
