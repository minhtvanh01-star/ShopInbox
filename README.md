# ShopInbox

Web app inbox đa kênh cho cửa hàng: gom tin nhắn, trả lời, lưu đơn hàng.

Hiện tại: **Lát 2** — PostgreSQL + Prisma + UI đọc/ghi DB + đăng nhập (bcrypt + session). Chưa nối Facebook / Zalo / Instagram thật.

## Yêu cầu

- Node.js 20+
- Docker Desktop đang chạy (chỉ cần nền — làm việc bằng lệnh)

## 1. Bật database

```powershell
cd E:\project_job\ShopInbox
docker compose up -d
docker compose ps
```

Postgres ở cổng **5433**.

## 2. Cài package + migrate + seed

```powershell
npm install
npx prisma migrate dev
npx prisma db seed
```

## 3. Chạy app

```powershell
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) → trang đăng nhập.

### Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| Admin (chủ shop) | `admin@lily.vn` | `Admin@123` |
| Nhân viên | `nhanvien@lily.vn` | `Staff@123` |

- Mật khẩu lưu **bcrypt hash** trong bảng `staff` (không lưu plain text).
- Admin vào menu **Nhân viên** để thêm tài khoản mới.
- Đăng xuất xóa cookie session.

## 4. Kiểm tra dữ liệu

```powershell
npx prisma studio
```

Mở [http://localhost:5555](http://localhost:5555).

## 5. Chạy test

```powershell
npm test
```

## Biến môi trường

Copy `.env.example` → `.env`:

```
DATABASE_URL="postgresql://shopinbox:shopinbox@localhost:5433/shopinbox"
SESSION_SECRET="shopinbox-dev-session-secret-change-me"
```

Đổi `SESSION_SECRET` khi deploy. Không commit `.env`.
