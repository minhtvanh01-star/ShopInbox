"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { bumpStaffSessionVersion, loadStaffSession } from "@/backend/auth";
import { requirePermission } from "@/backend/rbac";
import { validateProfileInput } from "@/backend/google-auth";
import { hashPassword, verifyPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { setSessionCookie } from "@/backend/session";
import { saveShopImageUpload } from "@/backend/upload-store";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import { validateStaffAvatarFile } from "@/lib/staff-avatar";

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
    },
  });

  await setSessionCookie(await loadStaffSession(session.staffId));

  await writeAudit({
    actor: { ...session, name: validated.data.name },
    action: AUDIT_ACTIONS.profileUpdate,
    entityType: "Profile",
    entityId: staff.id,
    metadata: { fields: ["name", "phone"] },
  });

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { success: "Đã lưu hồ sơ cá nhân." };
}

export async function updateAvatarAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requirePermission(PERMISSION_CODES.profileUpdate);
  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return { error: "Chọn một ảnh để làm ảnh đại diện." };
  }

  const fileCheck = validateStaffAvatarFile(file);
  if (!fileCheck.ok) {
    return { error: fileCheck.error };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let saved;
  try {
    saved = await saveShopImageUpload({
      shopId: session.shopId,
      bytes,
      mimeType: file.type || "image/jpeg",
      originalName: file.name,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Không lưu được ảnh đại diện." };
  }

  await prisma.staff.update({
    where: { id: session.staffId },
    data: { avatarUrl: saved.publicPath },
  });

  await setSessionCookie(await loadStaffSession(session.staffId));

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.profileUpdate,
    entityType: "Profile",
    entityId: session.staffId,
    metadata: { fields: ["avatarUrl"] },
  });

  revalidatePath("/settings/profile");
  revalidatePath("/staff");
  revalidatePath("/admin/shops");
  revalidatePath("/", "layout");
  return { success: "Đã lưu ảnh đại diện." };
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
  await bumpStaffSessionVersion(session.staffId);
  await setSessionCookie(await loadStaffSession(session.staffId));

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.profilePasswordChange,
    entityType: "Profile",
    entityId: staff.id,
  });

  revalidatePath("/settings/profile");
  return { success: "Đã đổi mật khẩu." };
}
