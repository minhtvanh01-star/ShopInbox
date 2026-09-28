"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { requireSuperAdmin } from "@/backend/super-admin";
import { setShopSuspended, setStaffSuperAdmin, updateShopOps } from "@/backend/platform-shops";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";
import { maskEmail } from "@/lib/mask-email";
import { parseShopOpsInput } from "@/lib/shop-ops";
import { runChannelSyncSweep } from "@/backend/channel-sync-sweep";
import { markChannelSyncRan, saveChannelSyncSettings } from "@/backend/platform-channel-sync";
import { normalizeChannelSyncInterval } from "@/lib/channel-sync";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { PLATFORM_SHOP_ID } from "@/lib/super-admin";

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
    shopId: result.shopId,
    metadata: { email: result.email },
  });

  revalidatePath("/admin/shops");
  return {
    success: grant
      ? `Đã gán Super admin cho ${maskEmail(result.email)}.`
      : `Đã gỡ Super admin của ${maskEmail(result.email)}.`,
  };
}

export type ChannelSyncActionState = {
  error?: string;
  success?: string;
};

export async function updateChannelSyncAction(
  _prev: ChannelSyncActionState,
  formData: FormData,
): Promise<ChannelSyncActionState> {
  const session = await requireSuperAdmin();
  const enabled = String(formData.get("channelSyncEnabled") ?? "") === "1";
  const intervalSec = normalizeChannelSyncInterval(formData.get("minutes"), formData.get("seconds"));
  if (intervalSec === null) {
    return { error: "Khoảng quét từ 15 giây đến 60 phút." };
  }

  try {
    await saveChannelSyncSettings({ enabled, intervalSec });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      return { error: "Chưa migrate. Chạy prisma migrate deploy rồi restart." };
    }
    throw error;
  }
  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.channelSyncUpdate,
    entityType: "PlatformSetting",
    entityId: "platform",
    shopId: PLATFORM_SHOP_ID,
    metadata: { enabled, intervalSec },
  });
  revalidatePath("/admin/shops");
  return { success: "Đã lưu quét kênh." };
}

export async function runChannelSyncNowAction(
  _prev: ChannelSyncActionState,
  _formData: FormData,
): Promise<ChannelSyncActionState> {
  const session = await requireSuperAdmin();
  let result: Awaited<ReturnType<typeof runChannelSyncSweep>>;
  try {
    result = await runChannelSyncSweep();
    if (!result.skipped) {
      await markChannelSyncRan();
    }
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      return { error: "Chưa migrate. Chạy prisma migrate deploy rồi restart." };
    }
    throw error;
  }
  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.channelSyncRun,
    entityType: "PlatformSetting",
    entityId: "platform",
    shopId: PLATFORM_SHOP_ID,
    metadata: result,
  });
  revalidatePath("/admin/shops");
  if (result.skipped) {
    return { success: "Vòng quét trước vẫn đang chạy." };
  }
  return { success: `Đã quét ${result.channels} kênh, ${result.ingested} tin.` };
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
