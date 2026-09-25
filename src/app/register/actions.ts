"use server";

import { redirect } from "next/navigation";
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
import {
  planOpenRegistration,
  validateRegisterInput,
  REGISTER_DEFAULT_SHOP_ID,
} from "@/backend/register";
import { safeInternalPath } from "@/backend/safe-path";
import { setSessionCookie } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { getShopPolicy } from "@/backend/shop-policy";
import { assertShopHasActiveSeat } from "@/backend/shop-seats";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";
import { shopSeatLimitMessage } from "@/lib/shop-seats";

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

  if (shop) {
    if (plan.isActive) {
      const seatError = await assertShopHasActiveSeat(plan.shopId);
      if (seatError) {
        return { error: seatError, step: "form" };
      }
    } else {
      const [total, policy] = await Promise.all([
        prisma.staff.count({ where: { shopId: plan.shopId } }),
        getShopPolicy(plan.shopId),
      ]);
      if (total >= policy.maxUsersPerShop) {
        return { error: shopSeatLimitMessage(policy.maxUsersPerShop), step: "form" };
      }
    }
  }

  try {
    await createRegisterEmailOtp({
      email,
      name,
      passwordHash: await hashPassword(password),
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

  const created = await createOpenRegistrationStaff({
    email: verified.email,
    name: verified.payload.name,
    passwordHash: verified.payload.passwordHash,
  });

  if (!created.ok) {
    await discardRegisterEmailOtp(verified.email);
    return { error: created.error, step: "form", email: verified.email };
  }

  const staff = created.staff;
  await consumeRegisterEmailOtp(verified.challengeId);

  await writeAudit({
    actor: staff.isActive
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
    },
  });

  if (!staff.isActive) {
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
      error: publicOtpSendError(err, "Không gửi lại được mã. Thử lại sau."),
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
