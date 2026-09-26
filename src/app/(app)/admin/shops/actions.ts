"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { requireSuperAdmin } from "@/backend/super-admin";
import { setShopSuspended, setStaffSuperAdmin, updateShopOps } from "@/backend/platform-shops";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";
import { parseShopOpsInput } from "@/lib/shop-ops";

export type PlatformShopActionState = {
  error?: string;
  success?: string;
};

export async function toggleShopSuspendedAction(
  _prev: PlatformShopActionState,
  formData: FormData,
): Promise<PlatformShopActionState> {
  const session = await requireSuperAdmin();
  const shopId = String(formData.get("shopId") ?? "").trim();
  const suspend = String(formData.get("suspend") ?? "") === "1";
  const result = await setShopSuspended(shopId, suspend);
  if (!result.ok) return { error: result.error };

  await writeAudit({
    actor: session,
    action: suspend ? AUDIT_ACTIONS.shopSuspend : AUDIT_ACTIONS.shopResume,
    entityType: "Shop",
    entityId: shopId,
    shopId,
  });

  revalidatePath("/admin/shops");
  revalidatePath(`/admin/shops/${shopId}`);
  return { success: suspend ? "Đã tạm khóa shop." : "Đã mở lại shop." };
}

export async function toggleSuperAdminAction(
  _prev: PlatformShopActionState,
  formData: FormData,
): Promise<PlatformShopActionState> {
  const session = await requireSuperAdmin();
  const staffId = String(formData.get("staffId") ?? "").trim();
  const grant = String(formData.get("grant") ?? "") === "1";
  const result = await setStaffSuperAdmin(staffId, grant, session.staffId);
  if (!result.ok) return { error: result.error };

  await writeAudit({
    actor: session,
    action: grant ? AUDIT_ACTIONS.superAdminGrant : AUDIT_ACTIONS.superAdminRevoke,
    entityType: "Staff",
    entityId: staffId,
    metadata: { email: result.email },
  });

  revalidatePath("/admin/shops");
  return { success: grant ? `Đã gán Super admin cho ${result.email}.` : `Đã gỡ Super admin của ${result.email}.` };
}

export async function updateShopOpsAction(
  _prev: PlatformShopActionState,
  formData: FormData,
): Promise<PlatformShopActionState> {
  const session = await requireSuperAdmin();
  const shopId = String(formData.get("shopId") ?? "").trim();
  const parsed = parseShopOpsInput({
    planCode: formData.get("planCode"),
    planExpiresAt: formData.get("planExpiresAt"),
    supportStatus: formData.get("supportStatus"),
    supportTopic: formData.get("supportTopic"),
    supportNote: formData.get("supportNote"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const result = await updateShopOps(shopId, parsed.data);
  if (!result.ok) return { error: result.error };

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.shopOpsUpdate,
    entityType: "Shop",
    entityId: shopId,
    shopId,
    metadata: parsed.data,
  });

  revalidatePath("/admin/shops");
  revalidatePath(`/admin/shops/${shopId}`);
  return { success: "Đã lưu gói và nhu cầu hỗ trợ." };
}
