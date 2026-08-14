# Phân quyền và nhật ký hoạt động

ShopInbox không hardcode `if (role === "owner")` trong action/UI. Quyền lấy từ DB, nguồn mặc định là catalog `src/lib/rbac-catalog.ts`.

## Vai trò (seed)

| Code | Tên | Ghi chú |
|------|-----|---------|
| `admin` | Admin / Chủ shop | Toàn quyền. Tài khoản demo `admin@lily.vn`. JWT cũ `owner` được map thành `admin`. |
| `staff` | Nhân viên | Inbox, đơn, khách, hồ sơ. Demo `nhanvien@lily.vn`. |
| `manager` | Quản lý | Giống nhân viên, **thêm** `audit.read` và `staff.read`. Đã seed, `isActive: true`, chưa gán user. |

Bảng `roles`: `code`, `name`, `description`, `isSystem`, `isActive`, `sortOrder`.

## Bật vai trò Quản lý (chỉ cấu hình)

Không cần sửa code:

1. Role `manager` đã có trong seed. Nếu tắt: `UPDATE roles SET "isActive" = true WHERE code = 'manager';`
2. Gán user: trang **Nhân viên** (cần `staff.manage`) chọn vai trò **Quản lý**, hoặc `UPDATE staff SET "roleCode" = 'manager' WHERE email = '...';`
3. Muốn chỉnh quyền: sửa map `ROLE_PERMISSIONS` trong `src/lib/rbac-catalog.ts` rồi `npx prisma db seed` (seed đồng bộ lại `role_permissions`), hoặc sửa bảng `role_permissions` trực tiếp.

Thêm vai trò mới: thêm vào `ROLES` + `ROLE_PERMISSIONS` trong catalog, seed lại.

## Quyền (permissions)

Catalog / bảng `permissions`, gán qua `role_permissions`.

- `inbox.read` / `inbox.reply`
- `orders.read` / `orders.update` / `orders.create`
- `customers.read`
- `channels.connect` — OAuth, lưu cấu hình, ngắt kênh (admin)
- `staff.read` — xem danh sách nhân viên (admin, manager)
- `staff.manage` — thêm nhân viên (admin)
- `audit.read` — trang Nhật ký (admin, manager)
- `settings.update` / `profile.update`

Server: `hasPermission(session, code)`, `requirePermission(code)` trong `src/backend/rbac.ts`.

## Audit

Bảng `audit_logs`:

- `actorId`, `actorEmail`, `actorRole` (snapshot)
- `action`, `entityType`, `entityId`, `metadata` (JSON, đã lọc token/password)
- `ip`, `userAgent`, `shopId`, `createdAt`

Ghi (fail-soft) khi:

- Đăng nhập thành công / thất bại (`auth.login`, `auth.login_fail`) — không lưu mật khẩu
- Tạo nhân viên (`staff.create`)
- Kết nối / ngắt / lưu cấu hình kênh
- Tạo đơn / đổi trạng thái đơn
- Cập nhật hồ sơ / đổi mật khẩu
- Gửi tin nhắn inbox

UI: `/audit` — **Nhật ký hoạt động**, chỉ hiện trên sidebar nếu có `audit.read`.

Helper: `src/backend/audit.ts` → `writeAudit(...)`.

## Migrate

```powershell
npx prisma migrate dev
npx prisma db seed
```

Migration: `prisma/migrations/20260814180000_rbac_audit`.
