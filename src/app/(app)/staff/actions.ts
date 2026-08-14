"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { requirePermission, invalidatePermissionCache } from "@/backend/rbac";
import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import {
  AUDIT_ACTIONS,
  BOOTSTRAP_ROLE_CODE,
  DEFAULT_ROLE_CODE,
  PERMISSION_CODES,
  normalizeRoleCode,
} from "@/lib/rbac-catalog";

export type StaffActionState = {
  error?: string;
  success?: string;
};

async function countActiveBootstrapAdmins(shopId: string, excludeStaffId?: string) {
  return prisma.staff.count({
    where: {
      shopId,
      roleCode: BOOTSTRAP_ROLE_CODE,
      isActive: true,
      ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}),
    },
  });
}

export async function createStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await requirePermission(PERMISSION_CODES.staffManage);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = normalizeRoleCode(String(formData.get("role") ?? DEFAULT_ROLE_CODE));

  if (!name || !email || !password) {
    return { error: "Điền đủ tên, email và mật khẩu." };
  }
  if (password.length < 8) {
    return { error: "Mật khẩu tối thiểu 8 ký tự." };
  }
  if (!email.includes("@")) {
    return { error: "Email không hợp lệ." };
  }

  const role = await prisma.role.findFirst({
    where: { code: roleRaw, isActive: true },
  });
  if (!role) {
    return { error: "Vai trò không hợp lệ hoặc đã tắt." };
  }

  const existing = await prisma.staff.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email này đã được dùng." };
  }

  const created = await prisma.staff.create({
    data: {
      id: `staff-${crypto.randomUUID()}`,
      shopId: session.shopId,
      name,
      email,
      passwordHash: await hashPassword(password),
      roleCode: role.code,
      isActive: true,
    },
  });

  invalidatePermissionCache(created.id);

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.staffCreate,
    entityType: "Staff",
    entityId: created.id,
    metadata: { email, roleCode: role.code },
  });

  revalidatePath("/staff");
  return { success: `Đã thêm tài khoản ${email}.` };
}

export async function updateStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await requirePermission(PERMISSION_CODES.staffManage);

  const staffId = String(formData.get("staffId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roleRaw = normalizeRoleCode(String(formData.get("role") ?? DEFAULT_ROLE_CODE));
  const activeRaw = String(formData.get("isActive") ?? "true");
  const isActive = activeRaw === "true" || activeRaw === "1" || activeRaw === "on";

  if (!staffId || !name) {
    return { error: "Thiếu thông tin nhân viên." };
  }

  const target = await prisma.staff.findFirst({
    where: { id: staffId, shopId: session.shopId },
  });
  if (!target) {
    return { error: "Không tìm thấy nhân viên." };
  }

  const role = await prisma.role.findFirst({
    where: { code: roleRaw, isActive: true },
  });
  if (!role) {
    return { error: "Vai trò không hợp lệ hoặc đã tắt." };
  }

  const wasBootstrapAdmin = target.roleCode === BOOTSTRAP_ROLE_CODE && target.isActive;
  const remainsBootstrapAdmin = role.code === BOOTSTRAP_ROLE_CODE && isActive;

  if (wasBootstrapAdmin && !remainsBootstrapAdmin) {
    const others = await countActiveBootstrapAdmins(session.shopId, target.id);
    if (others === 0) {
      return { error: "Không thể hạ quyền hoặc tắt admin cuối cùng của shop." };
    }
  }

  if (target.id === session.staffId && !isActive) {
    return { error: "Không thể tự vô hiệu hóa tài khoản đang đăng nhập." };
  }

  const updated = await prisma.staff.update({
    where: { id: target.id },
    data: {
      name,
      roleCode: role.code,
      isActive,
    },
  });

  invalidatePermissionCache(updated.id);

  const changed =
    target.name !== updated.name ||
    target.roleCode !== updated.roleCode ||
    target.isActive !== updated.isActive;

  if (changed) {
    const disabled = target.isActive && !updated.isActive;
    await writeAudit({
      actor: session,
      action: disabled ? AUDIT_ACTIONS.staffDisable : AUDIT_ACTIONS.staffUpdate,
      entityType: "Staff",
      entityId: updated.id,
      metadata: {
        email: updated.email,
        from: {
          name: target.name,
          roleCode: target.roleCode,
          isActive: target.isActive,
        },
        to: {
          name: updated.name,
          roleCode: updated.roleCode,
          isActive: updated.isActive,
        },
      },
    });
  }

  revalidatePath("/staff");
  return {
    success: updated.isActive
      ? `Đã cập nhật ${updated.email}.`
      : `Đã vô hiệu hóa ${updated.email}.`,
  };
}
