"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import { requireSession } from "@/backend/auth";
import { abandonIncompleteShopRegistration } from "@/backend/abandon-shop-registration";
import { validateProfileInput } from "@/backend/google-auth";
import { prisma } from "@/backend/prisma";
import { clearSessionCookie } from "@/backend/session";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";
import { SHOP_SETUP_PATH } from "@/lib/shop-setup";

export type RegisterProfileState = {
  error?: string;
};

export async function completeRegisterProfileAction(
  _prev: RegisterProfileState,
  formData: FormData,
): Promise<RegisterProfileState> {
  const session = await requireSession();
  const parsed = validateProfileInput({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }
  if (!parsed.data.phone) {
    return { error: "Nhập số điện thoại để hoàn tất hồ sơ." };
  }

  try {
    await prisma.staff.update({
      where: { id: session.staffId },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        ...(parsed.data.avatarUrl ? { avatarUrl: parsed.data.avatarUrl } : {}),
      },
    });
  } catch {
    await prisma.staff.update({
      where: { id: session.staffId },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
      },
    });
  }

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.profileUpdate,
    entityType: "Staff",
    entityId: session.staffId,
    metadata: { source: "register_profile" },
  });

  redirect(SHOP_SETUP_PATH);
}

export async function abandonShopRegistrationAction(
  _prev: RegisterProfileState,
  _formData: FormData,
): Promise<RegisterProfileState> {
  const session = await requireSession();
  const result = await abandonIncompleteShopRegistration(session);
  if (!result.ok) {
    return { error: result.error };
  }

  await writeAudit({
    actorEmail: session.email,
    actorRole: session.role,
    action: AUDIT_ACTIONS.authRegisterAbandon,
    entityType: "Shop",
    entityId: result.shopId,
    metadata: { staffId: session.staffId, abandonedShopId: result.shopId },
  });
  await clearSessionCookie();
  redirect("/login?auth_success=registration_cancelled");
}
