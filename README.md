# ShopInbox

Web app inbox đa kênh cho cửa hàng: gom tin nhắn, trả lời, lưu đơn hàng.

Hiện tại: **Lát 3** — đăng nhập + Inbox đọc/ghi DB + **tạo đơn từ chat**. Chưa nối Facebook / Zalo / Instagram thật.

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

Copy `.env.example` → `.env`:

```
DATABASE_URL="postgresql://shopinbox:shopinbox@localhost:5433/shopinbox"
SESSION_SECRET="shopinbox-dev-session-secret-change-me"
```

Đổi `SESSION_SECRET` khi deploy. Không commit `.env`.

## Cài đặt kênh

Menu **Cài đặt** → **Thêm kết nối** để lưu App ID, secret, Page/OA ID (chưa OAuth thật).

Hướng dẫn lấy credential từ Meta / Zalo / web widget: [docs/ket-noi-kenh.md](docs/ket-noi-kenh.md).

## Cấu trúc src

Next.js **giữ** `src/app` (App Router) và `src/middleware.ts` đúng chỗ. Tách backend/frontend bằng thư mục, không dời route.

```
src/
  app/            # Routes (page.tsx, layout.tsx) + server actions cạnh từng trang
  components/     # React UI — đây là frontend
    auth/         # LoginForm
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

