"use server";

import { writeAudit } from "@/backend/audit";
import {
  consumeRegisterEmailOtp,
  createRegisterEmailOtp,
  discardRegisterEmailOtp,
  verifyRegisterEmailOtp,
} from "@/backend/email-otp";
import { publicOtpSendError } from "@/backend/email";
import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { createOpenRegistrationStaff } from "@/backend/open-registration";
import { loadStaffSession } from "@/backend/auth";
import { planOpenRegistration, validateRegisterInput } from "@/backend/register";
import { ensureFirstSuperAdminGranted } from "@/backend/prod-bootstrap";
import { setSessionCookie } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { databaseErrorMessage } from "@/lib/database-url";
import { shouldSkipRegisterOtp } from "@/lib/first-run";
import { maskEmail } from "@/lib/mask-email";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";
import { postAuthPath, PROFILE_ONBOARD_PATH } from "@/lib/shop-setup";

export type RegisterActionState = {
  error?: string;
  step?: "form" | "otp";
  email?: string;
  message?: string;
  redirectTo?: string;
};

export async function registerAction(
  _prev: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const validated = validateRegisterInput({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!validated.ok) {
    return { error: validated.error, step: "form" };
  }

  const { name, email, password } = validated.data;

  let staffCount = 0;
  let existing: { id: string } | null;
  try {
    [staffCount, existing] = await Promise.all([
      prisma.staff.count(),
      prisma.staff.findUnique({ where: { email }, select: { id: true } }),
    ]);
  } catch (error) {
    console.error("[registerAction] staff lookup failed", error);
    return { error: databaseErrorMessage(error), step: "form" };
  }
  const plan = planOpenRegistration({ emailTaken: Boolean(existing) });
  if (!plan.ok) {
    return { error: plan.error, step: "form" };
  }

  const passwordHash = await hashPassword(password);
  if (shouldSkipRegisterOtp(staffCount)) {
    return finishOpenRegistration({
      email,
      name,
      passwordHash,
      method: "password_first_run",
    });
  }

  try {
    await createRegisterEmailOtp({
      email,
      name,
      passwordHash,
    });
  } catch (err) {
    return {
      error: publicOtpSendError(err, "Không gửi được mã xác thực. Thử lại sau."),
      step: "form",
    };
  }

  return {
    step: "otp",
    email,
    message: `Đã gửi mã 6 số tới ${maskEmail(email)}. Kiểm tra hộp thư (và Spam).`,
  };
}

export async function verifyRegisterOtpAction(
  _prev: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "");

  const verified = await verifyRegisterEmailOtp({ email, code });
  if (!verified.ok) {
    return { error: verified.error, step: "otp", email };
  }

  const finished = await finishOpenRegistration({
    email: verified.email,
    name: verified.payload.name,
    passwordHash: verified.payload.passwordHash,
    method: "password_email_otp",
    emailVerified: true,
  });
  if (finished.error) {
    await discardRegisterEmailOtp(verified.email);
    return { error: finished.error, step: "form", email: verified.email };
  }
  await consumeRegisterEmailOtp(verified.challengeId);
  return finished;
}

async function finishOpenRegistration(input: {
  email: string;
  name: string;
  passwordHash: string;
  method: string;
  emailVerified?: boolean;
}): Promise<RegisterActionState> {
  const created = await createOpenRegistrationStaff({
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
    emailVerified: input.emailVerified,
  });

  if (!created.ok) {
    return { error: created.error, step: "form", email: input.email };
  }

  const staff = created.staff;
  try {
    await ensureFirstSuperAdminGranted();
  } catch (error) {
    console.error("[registerAction] Super admin grant failed", error);
  }

  try {
    await writeAudit({
      actor: toSessionPayload(staff),
      action: AUDIT_ACTIONS.authRegister,
      entityType: "Staff",
      entityId: staff.id,
      metadata: {
        method: input.method,
        roleCode: staff.roleCode,
        isActive: staff.isActive,
        shopCreated: true,
      },
    });
    const session = await loadStaffSession(staff.id);
    await setSessionCookie(session);
    return { redirectTo: postAuthPath(session, PROFILE_ONBOARD_PATH) };
  } catch (error) {
    console.error("[registerAction] session after register failed", error);
    return {
      error: "Tạo tài khoản được nhưng không mở được trang. Đăng nhập lại.",
      step: "form",
      email: input.email,
    };
  }
}

export async function resendRegisterOtpAction(
  _prev: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { error: "Thiếu email.", step: "form" };
  }

  const challenge = await prisma.emailOtpChallenge.findFirst({
    where: { email, purpose: "register" },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return {
      error: "Phiên đăng ký đã hết. Hãy điền lại form đăng ký.",
      step: "form",
    };
  }

  const { parseRegisterOtpPayload } = await import("@/backend/email-otp-code");
  const payload = parseRegisterOtpPayload(challenge.payloadJson);
  if (!payload) {
    return { error: "Phiên đăng ký không hợp lệ. Hãy đăng ký lại.", step: "form" };
  }

  try {
    await createRegisterEmailOtp({
      email,
      name: payload.name,
      passwordHash: payload.passwordHash,
    });
  } catch (err) {
    return {
      error: publicOtpSendError(err, "Không gửi lại được mã. Thử lại sau."),
      step: "otp",
      email,
    };
  }

  return {
    step: "otp",
    email,
    message: `Đã gửi lại mã tới ${maskEmail(email)}.`,
  };
}
