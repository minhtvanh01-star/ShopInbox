"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import { loadStaffSession } from "@/backend/auth";
import { acceptShopInvite } from "@/backend/shop-invite";
import { setSessionCookie } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";

export type AcceptInviteState = {
  error?: string;
};

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "").trim();
  const result = await acceptShopInvite({
    token,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  await writeAudit({
    actor: toSessionPayload(result.staff),
    action: AUDIT_ACTIONS.staffInviteAccept,
    entityType: "Staff",
    entityId: result.staff.id,
    metadata: { shopId: result.staff.shopId, roleCode: result.staff.roleCode },
  });

  await setSessionCookie(await loadStaffSession(result.staff.id));
  redirect("/inbox");
}
