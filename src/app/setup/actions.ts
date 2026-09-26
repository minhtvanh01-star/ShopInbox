"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import { loadStaffSession, requireSession } from "@/backend/auth";
import { prisma } from "@/backend/prisma";
import { hasPermission } from "@/backend/rbac";
import { setSessionCookie } from "@/backend/session";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import { parseShopPolicyInput } from "@/lib/shop-policy";
import { validateShopName } from "@/lib/shop-name";

export type SetupShopState = {
  error?: string;
};

export async function completeShopSetupAction(
  _prev: SetupShopState,
  formData: FormData,
): Promise<SetupShopState> {
  const session = await requireSession();
  const canSetup = await hasPermission(session, PERMISSION_CODES.settingsUpdate);
  if (!canSetup) {
    return { error: "Chỉ chủ shop / admin mới cấu hình cửa hàng được." };
  }

  const shopName = validateShopName(formData.get("shopName"));
  if (!shopName.ok) {
    return { error: shopName.error };
  }

  const policy = parseShopPolicyInput({
    replyClaimTtlMinutes: formData.get("replyClaimTtlMinutes"),
    maxUsersPerShop: formData.get("maxUsersPerShop"),
  });
  if (!policy.ok) {
    return { error: policy.error };
  }

  const shop = await prisma.shop.findUnique({
    where: { id: session.shopId },
    select: { setupCompletedAt: true },
  });
  if (!shop) {
    return { error: "Không tìm thấy cửa hàng." };
  }

  await prisma.shop.update({
    where: { id: session.shopId },
    data: {
      name: shopName.name,
      replyClaimTtlMinutes: policy.policy.replyClaimTtlMinutes,
      maxUsersPerShop: policy.policy.maxUsersPerShop,
      setupCompletedAt: shop.setupCompletedAt ?? new Date(),
    },
  });

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.shopSetup,
    entityType: "Shop",
    entityId: session.shopId,
    metadata: {
      name: shopName.name,
      replyClaimTtlMinutes: policy.policy.replyClaimTtlMinutes,
      maxUsersPerShop: policy.policy.maxUsersPerShop,
    },
  });

  await setSessionCookie(await loadStaffSession(session.staffId));
  redirect("/settings");
}
