-- CreateTable
CREATE TABLE "roles" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "permissions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "group_name" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleCode" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleCode","permissionCode")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Seed roles
INSERT INTO "roles" ("code", "name", "description", "isSystem", "isActive", "sortOrder") VALUES
  ('admin', 'Admin / Chủ shop', 'Chủ shop — toàn quyền, gồm nhân viên và kết nối kênh.', true, true, 10),
  ('manager', 'Quản lý', 'Giống nhân viên, thêm xem nhật ký và danh sách nhân viên. Gán user khi cần — không sửa code.', true, true, 20),
  ('staff', 'Nhân viên', 'Inbox, đơn hàng, khách, hồ sơ cá nhân.', true, true, 30);

-- Seed permissions
INSERT INTO "permissions" ("code", "name", "description", "group_name") VALUES
  ('inbox.read', 'Xem inbox', 'Xem danh sách hội thoại và tin nhắn.', 'inbox'),
  ('inbox.reply', 'Trả lời inbox', 'Gửi tin nhắn từ shop.', 'inbox'),
  ('orders.read', 'Xem đơn hàng', 'Xem danh sách đơn.', 'orders'),
  ('orders.update', 'Cập nhật đơn', 'Đổi trạng thái đơn hàng.', 'orders'),
  ('orders.create', 'Tạo đơn', 'Tạo đơn từ hội thoại.', 'orders'),
  ('customers.read', 'Xem khách', 'Xem danh sách khách hàng.', 'customers'),
  ('channels.connect', 'Kết nối kênh', 'OAuth / lưu cấu hình / ngắt kết nối kênh.', 'channels'),
  ('staff.read', 'Xem nhân viên', 'Xem danh sách tài khoản nhân viên.', 'staff'),
  ('staff.manage', 'Quản lý nhân viên', 'Thêm, sửa vai trò nhân viên.', 'staff'),
  ('audit.read', 'Xem nhật ký', 'Xem audit trail (ai làm gì).', 'audit'),
  ('settings.update', 'Cài đặt shop', 'Sửa cấu hình cửa hàng.', 'settings'),
  ('profile.update', 'Sửa hồ sơ', 'Cập nhật hồ sơ cá nhân.', 'profile');

-- admin: all permissions
INSERT INTO "role_permissions" ("roleCode", "permissionCode")
SELECT 'admin', "code" FROM "permissions";

-- staff
INSERT INTO "role_permissions" ("roleCode", "permissionCode") VALUES
  ('staff', 'inbox.read'),
  ('staff', 'inbox.reply'),
  ('staff', 'orders.read'),
  ('staff', 'orders.update'),
  ('staff', 'orders.create'),
  ('staff', 'customers.read'),
  ('staff', 'profile.update');

-- manager: staff + audit.read + staff.read
INSERT INTO "role_permissions" ("roleCode", "permissionCode") VALUES
  ('manager', 'inbox.read'),
  ('manager', 'inbox.reply'),
  ('manager', 'orders.read'),
  ('manager', 'orders.update'),
  ('manager', 'orders.create'),
  ('manager', 'customers.read'),
  ('manager', 'profile.update'),
  ('manager', 'audit.read'),
  ('manager', 'staff.read');

-- Migrate staff.role enum → roleCode (owner → admin)
ALTER TABLE "staff" ADD COLUMN "roleCode" TEXT;

UPDATE "staff"
SET "roleCode" = CASE
  WHEN "role"::text = 'owner' THEN 'admin'
  ELSE 'staff'
END;

ALTER TABLE "staff" ALTER COLUMN "roleCode" SET NOT NULL;
ALTER TABLE "staff" DROP COLUMN "role";

DROP TYPE "StaffRole";

-- ForeignKeys
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "roles"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff" ADD CONSTRAINT "staff_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "staff_roleCode_idx" ON "staff"("roleCode");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_shopId_createdAt_idx" ON "audit_logs"("shopId", "createdAt");
