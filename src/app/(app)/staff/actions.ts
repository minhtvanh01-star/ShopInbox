"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { bumpStaffSessionVersion } from "@/backend/auth";
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
import {
  EMAIL_RE,
  REGISTER_MIN_PASSWORD_LENGTH,
  REGISTER_NAME_MAX,
} from "@/lib/auth-password";
import { assertShopHasActiveSeat } from "@/backend/shop-seats";
import {
  LAST_SUPER_ADMIN_DISABLE_BLOCKED,
  SUPER_ADMIN_SHOP_MUTATION_BLOCKED,
  canShopStaffMutateMember,
  isSuperAdminSession,
  shouldBlockLastActiveSuperAdmin,
} from "@/lib/super-admin";

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
  if (name.length > REGISTER_NAME_MAX) {
    return { error: `Họ tên tối đa ${REGISTER_NAME_MAX} ký tự.` };
  }
  if (password.length < REGISTER_MIN_PASSWORD_LENGTH) {
    return { error: `Mật khẩu tối thiểu ${REGISTER_MIN_PASSWORD_LENGTH} ký tự.` };
  }
  if (!EMAIL_RE.test(email)) {
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

  const seatError = await assertShopHasActiveSeat(session.shopId);
  if (seatError) {
    return { error: seatError };
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
  if (name.length > REGISTER_NAME_MAX) {
    return { error: `Họ tên tối đa ${REGISTER_NAME_MAX} ký tự.` };
  }

  const target = await prisma.staff.findFirst({
    where: { id: staffId, shopId: session.shopId },
  });
  if (!target) {
    return { error: "Không tìm thấy nhân viên." };
  }

  if (
    !canShopStaffMutateMember({
      actorIsSuperAdmin: isSuperAdminSession(session),
      targetIsSuperAdmin: target.isSuperAdmin,
    })
  ) {
    return { error: SUPER_ADMIN_SHOP_MUTATION_BLOCKED };
  }

  if (target.isSuperAdmin && !isActive) {
    const otherActiveSuperAdmins = await prisma.staff.count({
      where: { isSuperAdmin: true, isActive: true, id: { not: target.id } },
    });
    if (
      shouldBlockLastActiveSuperAdmin({
        targetIsSuperAdmin: true,
        nextIsActive: false,
        otherActiveSuperAdminCount: otherActiveSuperAdmins,
      })
    ) {
      return { error: LAST_SUPER_ADMIN_DISABLE_BLOCKED };
    }
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

  if (!target.isActive && isActive) {
    const seatError = await assertShopHasActiveSeat(session.shopId, {
      excludeStaffId: target.id,
    });
    if (seatError) {
      return { error: seatError };
    }
  }

  const revokeSession = target.roleCode !== role.code || target.isActive !== isActive;
  const updated = await prisma.staff.update({
    where: { id: target.id },
    data: {
      name,
      roleCode: role.code,
      isActive,
    },
  });

  if (revokeSession) {
    await bumpStaffSessionVersion(updated.id);
  }
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

export async function resetStaffPasswordAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await requirePermission(PERMISSION_CODES.staffManage);
  const staffId = String(formData.get("staffId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!staffId) {
    return { error: "Thiếu nhân viên." };
  }
  if (password.length < REGISTER_MIN_PASSWORD_LENGTH) {
    return { error: `Mật khẩu tối thiểu ${REGISTER_MIN_PASSWORD_LENGTH} ký tự.` };
  }
  if (password !== confirmPassword) {
    return { error: "Mật khẩu xác nhận không khớp." };
  }

  const target = await prisma.staff.findFirst({
    where: { id: staffId, shopId: session.shopId },
  });
  if (!target) {
    return { error: "Không tìm thấy nhân viên." };
  }

  if (
    !canShopStaffMutateMember({
      actorIsSuperAdmin: isSuperAdminSession(session),
      targetIsSuperAdmin: target.isSuperAdmin,
    })
  ) {
    return { error: SUPER_ADMIN_SHOP_MUTATION_BLOCKED };
  }

  await prisma.staff.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(password) },
  });
  await bumpStaffSessionVersion(target.id);

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.staffPasswordReset,
    entityType: "Staff",
    entityId: target.id,
    metadata: { email: target.email },
  });

  revalidatePath("/staff");
  return { success: `Đã đặt mật khẩu mới cho ${target.email}.` };
}

export type InviteActionState = {
  error?: string;
  success?: string;
  inviteUrl?: string;
};

export async function createStaffInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await requirePermission(PERMISSION_CODES.staffManage);
  const { createShopInvite } = await import("@/backend/shop-invite");
  const result = await createShopInvite({
    shopId: session.shopId,
    createdByStaffId: session.staffId,
    roleCode: String(formData.get("role") ?? DEFAULT_ROLE_CODE),
    email: String(formData.get("email") ?? ""),
  });
  if (!result.ok) {
    return { error: result.error };
  }

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.staffInviteCreate,
    entityType: "ShopInvite",
    entityId: result.invite.id,
    metadata: { email: result.invite.email, roleCode: result.invite.roleCode },
  });

  revalidatePath("/staff");
  return {
    success: result.invite.email
      ? `Đã tạo lời mời cho ${result.invite.email}. Gửi link bên dưới.`
      : "Đã tạo link mời. Gửi cho nhân viên — họ sẽ vào đúng shop này.",
    inviteUrl: result.url,
  };
}

export async function revokeStaffInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await requirePermission(PERMISSION_CODES.staffManage);
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const { revokeShopInvite } = await import("@/backend/shop-invite");
  const result = await revokeShopInvite(session.shopId, inviteId);
  if (!result.ok) {
    return { error: result.error };
  }

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.staffInviteRevoke,
    entityType: "ShopInvite",
    entityId: inviteId,
  });

  revalidatePath("/staff");
  return { success: "Đã thu hồi lời mời." };
}
