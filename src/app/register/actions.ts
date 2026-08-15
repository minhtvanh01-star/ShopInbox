"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import {
  consumeRegisterEmailOtp,
  createRegisterEmailOtp,
  discardRegisterEmailOtp,
  verifyRegisterEmailOtp,
} from "@/backend/email-otp";
import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import {
  planOpenRegistration,
  validateRegisterInput,
  REGISTER_DEFAULT_SHOP_ID,
} from "@/backend/register";
import { safeInternalPath } from "@/backend/safe-path";
import { setSessionCookie } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { AUDIT_ACTIONS, normalizeRoleCode } from "@/lib/rbac-catalog";

export type RegisterActionState = {
  error?: string;
  step?: "form" | "otp";
  email?: string;
  message?: string;
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

  const [existing, staffCount, shop] = await Promise.all([
    prisma.staff.findUnique({ where: { email }, select: { id: true } }),
    prisma.staff.count(),
    prisma.shop.findUnique({
      where: { id: REGISTER_DEFAULT_SHOP_ID },
      select: { id: true },
    }),
  ]);

  const plan = planOpenRegistration({
    staffCount,
    shopExists: Boolean(shop),
    emailTaken: Boolean(existing),
  });

  if (!plan.ok) {
    return { error: plan.error, step: "form" };
  }

  try {
    await createRegisterEmailOtp({
      email,
      name,
      passwordHash: await hashPassword(password),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Không gửi được mã xác thực.",
      step: "form",
    };
  }

  return {
    step: "otp",
    email,
    message: `Đã gửi mã 6 số tới ${email}. Kiểm tra hộp thư (và Spam).`,
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
  const nextPath = safeInternalPath(String(formData.get("next") ?? "/inbox"));

  const verified = await verifyRegisterEmailOtp({ email, code });
  if (!verified.ok) {
    return { error: verified.error, step: "otp", email };
  }

  const [staffCount, shop] = await Promise.all([
    prisma.staff.count(),
    prisma.shop.findUnique({
      where: { id: REGISTER_DEFAULT_SHOP_ID },
      select: { id: true },
    }),
  ]);

  const existing = await prisma.staff.findUnique({
    where: { email: verified.email },
    select: { id: true },
  });

  const plan = planOpenRegistration({
    staffCount,
    shopExists: Boolean(shop),
    emailTaken: Boolean(existing),
  });

  if (!plan.ok) {
    await discardRegisterEmailOtp(verified.email);
    return { error: plan.error, step: "form", email: verified.email };
  }

  if (plan.createShop) {
    await prisma.shop.create({
      data: {
        id: plan.createShop.id,
        name: plan.createShop.name,
      },
    });
  }

  const roleCode = normalizeRoleCode(plan.role);
  let staff;
  try {
    staff = await prisma.staff.create({
      data: {
        id: `staff-${crypto.randomUUID()}`,
        shopId: plan.shopId,
        name: verified.payload.name,
        email: verified.email,
        passwordHash: verified.payload.passwordHash,
        roleCode,
        isActive: plan.isActive,
      },
    });
  } catch {
    await discardRegisterEmailOtp(verified.email);
    return { error: "Email này đã được đăng ký.", step: "form", email: verified.email };
  }

  await consumeRegisterEmailOtp(verified.challengeId);

  await writeAudit({
    actor: plan.isActive
      ? toSessionPayload(staff)
      : {
          id: staff.id,
          email: staff.email,
          role: staff.roleCode,
          shopId: staff.shopId,
        },
    action: AUDIT_ACTIONS.authRegister,
    entityType: "Staff",
    entityId: staff.id,
    metadata: {
      method: "password_email_otp",
      roleCode: staff.roleCode,
      isActive: staff.isActive,
      pendingApproval: !staff.isActive,
      bootstrap: Boolean(plan.createShop) || staffCount === 0,
    },
  });

  if (!plan.isActive) {
    redirect("/login?auth_success=pending_approval");
  }

  const session = toSessionPayload(staff);
  await setSessionCookie(session);

  redirect(nextPath);
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
