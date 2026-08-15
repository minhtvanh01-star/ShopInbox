"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import {
  consumePasswordResetEmailOtp,
  createPasswordResetEmailOtp,
  discardPasswordResetEmailOtp,
  EMAIL_OTP_PURPOSE_PASSWORD_RESET,
  parsePasswordResetOtpPayload,
  verifyPasswordResetEmailOtp,
} from "@/backend/email-otp";
import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { validatePasswordResetInput } from "@/backend/register";
import { toSessionPayload } from "@/backend/session-token";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";

export type ForgotPasswordActionState = {
  error?: string;
  step?: "form" | "otp";
  email?: string;
  message?: string;
};

/** Thông báo chung — tránh lộ email có tồn tại hay không. */
const GENERIC_OTP_SENT =
  "Nếu email hợp lệ và có mật khẩu, chúng tôi đã gửi mã 6 số. Kiểm tra hộp thư (và Spam).";

export async function requestPasswordResetAction(
  _prev: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const validated = validatePasswordResetInput({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!validated.ok) {
    return { error: validated.error, step: "form" };
  }

  const { email, password } = validated.data;
  const staff = await prisma.staff.findUnique({
    where: { email },
    select: { id: true, isActive: true, passwordHash: true },
  });

  // Anti-enumeration: không gửi OTP nếu không đủ điều kiện, vẫn trả bước OTP chung.
  const eligible = Boolean(staff?.isActive && staff.passwordHash);
  if (eligible) {
    try {
      await createPasswordResetEmailOtp({
        email,
        passwordHash: await hashPassword(password),
      });
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Không gửi được mã xác minh.",
        step: "form",
      };
    }
  }

  return {
    step: "otp",
    email,
    message: GENERIC_OTP_SENT,
  };
}

export async function verifyPasswordResetOtpAction(
  _prev: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "");

  const verified = await verifyPasswordResetEmailOtp({ email, code });
  if (!verified.ok) {
    return { error: verified.error, step: "otp", email };
  }

  const staff = await prisma.staff.findUnique({
    where: { email: verified.email },
    select: {
      id: true,
      email: true,
      name: true,
      shopId: true,
      roleCode: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (!staff || !staff.isActive || !staff.passwordHash) {
    await discardPasswordResetEmailOtp(verified.email);
    return {
      error: "Không đổi được mật khẩu cho tài khoản này. Liên hệ admin shop.",
      step: "form",
      email: verified.email,
    };
  }

  await prisma.staff.update({
    where: { id: staff.id },
    data: { passwordHash: verified.payload.passwordHash },
  });
  await consumePasswordResetEmailOtp(verified.challengeId);

  await writeAudit({
    actor: toSessionPayload(staff),
    action: AUDIT_ACTIONS.authPasswordReset,
    entityType: "Staff",
    entityId: staff.id,
    metadata: { method: "email_otp" },
  });

  redirect("/login?reset=1");
}

export async function resendPasswordResetOtpAction(
  _prev: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { error: "Thiếu email.", step: "form" };
  }

  const challenge = await prisma.emailOtpChallenge.findFirst({
    where: { email, purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return {
      error: "Phiên đổi mật khẩu đã hết. Hãy điền lại form.",
      step: "form",
    };
  }

  const payload = parsePasswordResetOtpPayload(challenge.payloadJson);
  if (!payload) {
    return { error: "Phiên đổi mật khẩu không hợp lệ. Hãy thử lại.", step: "form" };
  }

  try {
    await createPasswordResetEmailOtp({
      email,
      passwordHash: payload.passwordHash,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Không gửi lại được mã.",
      step: "otp",
      email,
    };
  }

  return {
    step: "otp",
    email,
    message: `Đã gửi lại mã tới ${email}.`,
  };
}
