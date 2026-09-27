"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { bumpStaffSessionVersion, loadStaffSession } from "@/backend/auth";
import { requirePermission } from "@/backend/rbac";
import { validateProfileInput } from "@/backend/google-auth";
import { publicOtpSendError } from "@/backend/email";
import {
  consumeProfileEmailOtp,
  createProfilePasswordEmailOtp,
  createProfileVerifyEmailOtp,
  verifyProfilePasswordEmailOtp,
  verifyProfileVerifyEmailOtp,
} from "@/backend/email-otp";
import { hashPassword, verifyPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { setSessionCookie } from "@/backend/session";
import { saveShopImageUpload } from "@/backend/upload-store";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import { maskEmail } from "@/lib/mask-email";
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

export type ProfileOtpActionState = ProfileActionState & {
  step?: "form" | "otp";
  message?: string;
};

export async function requestProfileVerifyOtpAction(): Promise<ProfileOtpActionState> {
  const session = await requirePermission(PERMISSION_CODES.profileUpdate);
  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: session.staffId },
    select: { id: true, email: true, emailVerifiedAt: true, googleId: true },
  });

  if (staff.emailVerifiedAt || staff.googleId) {
    if (!staff.emailVerifiedAt) {
      await prisma.staff.update({
        where: { id: staff.id },
        data: { emailVerifiedAt: new Date() },
      });
      revalidatePath("/settings/profile");
    }
    return { success: "Email đã được xác nhận." };
  }

  try {
    await createProfileVerifyEmailOtp({ email: staff.email, staffId: staff.id });
  } catch (err) {
    return { error: publicOtpSendError(err, "Không gửi được mã xác nhận. Thử lại sau.") };
  }

  return {
    step: "otp",
    message: `Đã gửi mã 6 số tới ${maskEmail(staff.email)}. Kiểm tra hộp thư (và Spam).`,
  };
}

export async function confirmProfileVerifyOtpAction(
  _prev: ProfileOtpActionState,
  formData: FormData,
): Promise<ProfileOtpActionState> {
  const session = await requirePermission(PERMISSION_CODES.profileUpdate);
  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: session.staffId },
    select: { id: true, email: true },
  });
  const code = String(formData.get("code") ?? "");

  const verified = await verifyProfileVerifyEmailOtp({ email: staff.email, code });
  if (!verified.ok) {
    return { error: verified.error, step: "otp" };
  }
  if (verified.payload.staffId !== session.staffId) {
    return { error: "Phiên xác minh không khớp tài khoản.", step: "otp" };
  }

  await prisma.staff.update({
    where: { id: staff.id },
    data: { emailVerifiedAt: new Date() },
  });
  await consumeProfileEmailOtp(verified.challengeId);

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.profileEmailVerify,
    entityType: "Profile",
    entityId: staff.id,
  });

  revalidatePath("/settings/profile");
  return { success: "Đã xác nhận email hồ sơ." };
}

export async function requestProfilePasswordOtpAction(
  _prev: ProfileOtpActionState,
  formData: FormData,
): Promise<ProfileOtpActionState> {
  const session = await requirePermission(PERMISSION_CODES.profileUpdate);
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: session.staffId } });

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!newPassword) {
    return { error: "Nhập mật khẩu mới." };
  }
  if (newPassword.length < 8) {
    return { error: "Mật khẩu mới tối thiểu 8 ký tự." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Mật khẩu xác nhận không khớp." };
  }

  if (staff.passwordHash) {
    if (!currentPassword) {
      return { error: "Nhập mật khẩu hiện tại." };
    }
    const ok = await verifyPassword(currentPassword, staff.passwordHash);
    if (!ok) {
      return { error: "Mật khẩu hiện tại không đúng." };
    }
  }

  try {
    await createProfilePasswordEmailOtp({
      email: staff.email,
      staffId: staff.id,
      passwordHash: await hashPassword(newPassword),
    });
  } catch (err) {
    return { error: publicOtpSendError(err, "Không gửi được mã xác minh. Thử lại sau.") };
  }

  return {
    step: "otp",
    message: `Đã gửi mã 6 số tới ${maskEmail(staff.email)}. Nhập mã để ${staff.passwordHash ? "đổi" : "thêm"} mật khẩu.`,
  };
}

export async function confirmProfilePasswordOtpAction(
  _prev: ProfileOtpActionState,
  formData: FormData,
): Promise<ProfileOtpActionState> {
  const session = await requirePermission(PERMISSION_CODES.profileUpdate);
  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: session.staffId },
    select: { id: true, email: true, passwordHash: true },
  });
  const code = String(formData.get("code") ?? "");

  const verified = await verifyProfilePasswordEmailOtp({ email: staff.email, code });
  if (!verified.ok) {
    return { error: verified.error, step: "otp" };
  }
  if (verified.payload.staffId !== session.staffId || !verified.payload.passwordHash) {
    return { error: "Phiên đổi mật khẩu không hợp lệ. Hãy gửi lại mã.", step: "form" };
  }

  await prisma.staff.update({
    where: { id: staff.id },
    data: {
      passwordHash: verified.payload.passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  await bumpStaffSessionVersion(session.staffId);
  await setSessionCookie(await loadStaffSession(session.staffId));
  await consumeProfileEmailOtp(verified.challengeId);

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.profilePasswordChange,
    entityType: "Profile",
    entityId: staff.id,
    metadata: { via: "email_otp", added: !staff.passwordHash },
  });

  revalidatePath("/settings/profile");
  return {
    success: staff.passwordHash
      ? "Đã đổi mật khẩu. Có thể đăng nhập bằng email và mật khẩu."
      : "Đã thêm mật khẩu. Có thể đăng nhập bằng email mà không cần Google.",
  };
}
