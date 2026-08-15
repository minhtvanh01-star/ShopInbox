"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { planOpenRegistration, validateRegisterInput, REGISTER_DEFAULT_SHOP_ID } from "@/backend/register";
import { safeInternalPath } from "@/backend/safe-path";
import { setSessionCookie } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { AUDIT_ACTIONS, normalizeRoleCode } from "@/lib/rbac-catalog";

export type RegisterActionState = {
  error?: string;
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
    return { error: validated.error };
  }

  const nextPath = safeInternalPath(String(formData.get("next") ?? "/inbox"));
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
    return { error: plan.error };
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
        name,
        email,
        passwordHash: await hashPassword(password),
        roleCode,
        isActive: true,
      },
    });
  } catch {
    return { error: "Email này đã được đăng ký." };
  }

  const session = toSessionPayload(staff);
  await setSessionCookie(session);
  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.authRegister,
    entityType: "Staff",
    entityId: staff.id,
    metadata: {
      method: "password",
      roleCode: staff.roleCode,
      bootstrap: Boolean(plan.createShop) || staffCount === 0,
    },
  });

  redirect(nextPath);
}
