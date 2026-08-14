"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { requirePermission } from "@/backend/rbac";
import { validateProfileInput } from "@/backend/google-auth";
import { hashPassword, verifyPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { toSessionPayload } from "@/backend/session-token";
import { setSessionCookie } from "@/backend/session";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";

export type ProfileActionState = {
  error?: string;
  success?: string;
};

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requirePermission(PERMISSION_CODES.profileUpdate);

  const validated = validateProfileInput({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
  });

  if (!validated.ok) {
    return { error: validated.error };
  }

  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: session.staffId } });

  await prisma.staff.update({
    where: { id: session.staffId },
    data: {
      name: validated.data.name,
      phone: validated.data.phone || null,
      avatarUrl: validated.data.avatarUrl || null,
    },
  });

  await setSessionCookie(toSessionPayload({ ...staff, name: validated.data.name }));

  await writeAudit({
    actor: { ...session, name: validated.data.name },
    action: AUDIT_ACTIONS.profileUpdate,
    entityType: "Profile",
    entityId: staff.id,
    metadata: { fields: ["name", "phone", "avatarUrl"] },
  });

  revalidatePath("/settings/profile");
  return { success: "Đã lưu hồ sơ cá nhân." };
}

export async function changePasswordAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requirePermission(PERMISSION_CODES.profileUpdate);
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: session.staffId } });

  if (!staff.passwordHash) {
    return { error: "Tài khoản Google không đổi mật khẩu tại đây." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { error: "Nhập mật khẩu hiện tại và mật khẩu mới." };
  }

  const ok = await verifyPassword(currentPassword, staff.passwordHash);
  if (!ok) {
    return { error: "Mật khẩu hiện tại không đúng." };
  }

  if (newPassword.length < 8) {
    return { error: "Mật khẩu mới tối thiểu 8 ký tự." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Mật khẩu xác nhận không khớp." };
  }

  await prisma.staff.update({
    where: { id: session.staffId },
    data: {
      passwordHash: await hashPassword(newPassword),
    },
  });

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.profilePasswordChange,
    entityType: "Profile",
    entityId: staff.id,
  });

  revalidatePath("/settings/profile");
  return { success: "Đã đổi mật khẩu." };
}
