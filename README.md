# ShopInbox

Web app inbox đa kênh cho cửa hàng: gom tin nhắn, trả lời, lưu đơn hàng.

Hiện tại: đăng nhập + Inbox đọc/ghi DB + tạo đơn từ chat + **OAuth Facebook / Instagram / Zalo** (webhook đồng bộ tin).

## Yêu cầu

- Node.js 20+
- PostgreSQL cài trên máy (cổng **5432**). Không cần Docker.

## 1. Database local

Tạo database nếu chưa có (ví dụ `psql`):

```powershell
psql -h 127.0.0.1 -U postgres -d postgres -c "CREATE DATABASE shopinbox;"
```

Copy `.env.example` → `.env` rồi chỉnh `DATABASE_URL` cho khớp user/password máy bạn:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/shopinbox"
```

(Mật khẩu có ký tự đặc biệt thì URL-encode.)

## 2. Cài package + migrate + seed

```powershell
npm install
npx prisma migrate deploy
npx prisma generate
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
- **Đăng ký mở** tại `/register` (link **Đăng ký** trên `/login`): user đầu tiên → `admin`; user sau → `staff` vào shop mặc định `shop1` (chưa hỗ trợ chọn shop). Chi tiết: [docs/dang-nhap-google.md](docs/dang-nhap-google.md) mục đăng ký.
- **Hồ sơ cá nhân** (`/settings/profile`): cập nhật tên, SĐT, ảnh; liên kết Google; đổi mật khẩu (tài khoản email).
- **Đăng nhập với Google** trên trang `/login` khi đã cấu hình OAuth — xem [docs/dang-nhap-google.md](docs/dang-nhap-google.md).
- Đăng xuất xóa cookie session.
- Trong Inbox bấm **Tạo đơn** để lưu đơn vào PostgreSQL; trang Đơn hàng đổi trạng thái được.

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

Copy `.env.example` → `.env`. Mặc định trỏ Postgres **local** cổng 5432:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/shopinbox"
SESSION_SECRET="shopinbox-dev-session-secret-change-me"
```

Tuỳ chọn — đăng nhập Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Xem [docs/dang-nhap-google.md](docs/dang-nhap-google.md).

Đổi `SESSION_SECRET` khi deploy. Không commit `.env`.

### Docker (tuỳ chọn)

Không bắt buộc. Nếu muốn Postgres trong container thay vì bản cài máy:

```powershell
docker compose up -d
```

Rồi đổi `.env` sang `postgresql://shopinbox:shopinbox@127.0.0.1:5433/shopinbox` (cổng **5433** để khỏi trùng Postgres local 5432).

## Cài đặt kênh

1. Điền `META_APP_ID` / `META_APP_SECRET` (và `NEXT_PUBLIC_APP_URL`) trong `.env` — xem `.env.example`.
2. Trên Meta Developers dán **OAuth Redirect** = `{APP_URL}/api/connect/meta/callback` và **Webhook** = `{APP_URL}/api/webhooks/meta`.
3. Trong app: menu **Cài đặt** → **Thêm kết nối** → **Kết nối với Facebook/Instagram** (OAuth). Settings cũng hiện URL + verify token để copy.

Yêu cầu & lộ trình: [docs/yeu-cau-he-thong.md](docs/yeu-cau-he-thong.md).  
Kết nối FB/IG (checklist + lỗi hay gặp): [docs/ket-noi-meta-fb-ig.md](docs/ket-noi-meta-fb-ig.md).  
Tổng quan kênh Meta/Zalo: [docs/ket-noi-kenh.md](docs/ket-noi-kenh.md), env: [docs/env-checklist.md](docs/env-checklist.md).

## Cấu trúc src

Next.js **giữ** `src/app` (App Router) và `src/middleware.ts` đúng chỗ. Tách backend/frontend bằng thư mục, không dời route.

```
src/
  app/            # Routes (page.tsx, layout.tsx) + server actions cạnh từng trang
  components/     # React UI — đây là frontend
    auth/         # LoginForm, RegisterForm
    inbox/        # InboxWorkspace, CreateOrderForm
    staff/        # StaffManager
    settings/     # kết nối kênh
  backend/        # Chỉ chạy trên server: prisma, auth, session, password, JWT, order-code
  lib/            # Dùng chung: types.ts, labels.ts, mock.ts (seed)
  generated/      # Prisma Client (sinh tự động)
  middleware.ts   # Giữ tại src/middleware.ts
```

- **Frontend:** `app` + `components`. File có `"use client"` chạy trên **trình duyệt**.
- **Backend:** `src/backend` + server actions (`"use server"`) + Prisma. Chạy trên **server**, không lộ secret/cookie ra browser.
- **Shared:** `src/lib/types.ts`, `src/lib/labels.ts` — type và nhãn tiếng Việt, cả hai phía đều import được.

Query/mutation inbox-đơn (`src/lib/queries.ts`, `src/app/(app)/actions.ts`) và catalog kênh (`src/lib/channels.ts`) **tạm để nguyên** đến khi Lát 3 / kết nối kênh ổn định.

### Đặt tên (để tìm code)

| Loại | Quy ước | Ví dụ tìm |
|------|---------|-----------|
| Đọc DB / dữ liệu | `get*` | `getInboxData`, `getOrdersPageData`, `getSession`, `getChannelAccounts` |
| Ghi / form | động từ rõ hoặc `*Action` | `createOrder`, `loginAction`, `createStaffAction`, `saveChannelCredentialsAction` |
| Component | PascalCase = tên file | `InboxWorkspace`, `LoginForm`, `ChannelBadge`, `StaffManager` |
| Type domain | PascalCase | `ChannelAccount`, `SessionPayload`, `StaffRole` |
| Route Next.js | **không đổi** | `page.tsx`, `layout.tsx`, `middleware.ts` |

