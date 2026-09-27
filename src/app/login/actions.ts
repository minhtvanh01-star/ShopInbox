"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import {
  LOGIN_GENERIC_ERROR,
  LOGIN_THROTTLE_ERROR,
  clearLoginFailures,
  isLoginEmailThrottled,
  recordLoginFailure,
} from "@/backend/login-throttle";
import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { verifyPassword } from "@/backend/password";
import { loadStaffSession } from "@/backend/auth";
import { clearSessionCookie, getSession, setSessionCookie } from "@/backend/session";
import { safeInternalPath } from "@/backend/safe-path";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";
import { postAuthPath } from "@/lib/shop-setup";
import { ensureFirstAdminAccount, ensureProductionData } from "@/backend/prod-bootstrap";
import { resolveIsSuperAdmin } from "@/backend/super-admin";
import { databaseErrorMessage } from "@/lib/database-url";
import { readFirstAdminBootstrap } from "@/lib/first-run";

export type AuthActionState = {
  error?: string;
  success?: string;
  redirectTo?: string;
};

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeInternalPath(String(formData.get("next") ?? "/inbox"));

  if (!email || !password) {
    return { error: "Nhập email và mật khẩu." };
  }

  const firstAdmin = readFirstAdminBootstrap(process.env);
  if (firstAdmin && email === firstAdmin.email) {
    try {
      await ensureFirstAdminAccount();
    } catch (error) {
      console.error("[loginAction] first admin bootstrap failed", error);
      return { error: databaseErrorMessage(error) };
    }
  }
  void ensureProductionData().catch((error) => {
    console.error("[loginAction] production data bootstrap failed", error);
  });

  if (await isLoginEmailThrottled(email)) {
    await writeAudit({
      actorEmail: email,
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      metadata: { reason: "rate_limited", method: "password" },
    });
    return { error: LOGIN_THROTTLE_ERROR };
  }

  let staff: {
    id: string;
    shopId: string;
    email: string;
    name: string;
    roleCode: string;
    isActive: boolean;
    isSuperAdmin: boolean;
    passwordHash: string | null;
  } | null;
  try {
    staff = await prisma.staff.findUnique({
      where: { email },
      select: {
        id: true,
        shopId: true,
        email: true,
        name: true,
        roleCode: true,
        isActive: true,
        isSuperAdmin: true,
        passwordHash: true,
      },
    });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      console.error("[loginAction] staff lookup failed", error);
      return { error: databaseErrorMessage(error) };
    }
    try {
      const basic = await prisma.staff.findUnique({
        where: { email },
        select: {
          id: true,
          shopId: true,
          email: true,
          name: true,
          roleCode: true,
          isActive: true,
          passwordHash: true,
        },
      });
      staff = basic ? { ...basic, isSuperAdmin: false } : null;
    } catch (fallbackError) {
      console.error("[loginAction] staff fallback lookup failed", fallbackError);
      return { error: databaseErrorMessage(fallbackError) };
    }
  }
  if (!staff) {
    await recordLoginFailure(email);
    await writeAudit({
      actorEmail: email,
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      metadata: { reason: "not_found", method: "password" },
    });
    return { error: LOGIN_GENERIC_ERROR };
  }

  if (!staff.passwordHash) {
    await writeAudit({
      actor: {
        id: staff.id,
        email: staff.email,
        role: staff.roleCode,
        shopId: staff.shopId,
      },
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      entityId: staff.id,
      metadata: { reason: "google_only", method: "password" },
    });
    await recordLoginFailure(email);
    return { error: LOGIN_GENERIC_ERROR };
  }

  if (!staff.isActive) {
    await writeAudit({
      actor: {
        id: staff.id,
        email: staff.email,
        role: staff.roleCode,
        shopId: staff.shopId,
      },
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      entityId: staff.id,
      metadata: { reason: "inactive", method: "password" },
    });
    await recordLoginFailure(email);
    return { error: LOGIN_GENERIC_ERROR };
  }

  const ok = await verifyPassword(password, staff.passwordHash);
  if (!ok) {
    await recordLoginFailure(email);
    await writeAudit({
      actor: {
        id: staff.id,
        email: staff.email,
        role: staff.roleCode,
        shopId: staff.shopId,
      },
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      entityId: staff.id,
      metadata: { reason: "bad_password", method: "password" },
    });
    return { error: LOGIN_GENERIC_ERROR };
  }

  let shopSuspended = false;
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: staff.shopId },
      select: { suspendedAt: true },
    });
    shopSuspended = Boolean(shop?.suspendedAt);
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      console.error("[loginAction] shop lookup failed", error);
      return { error: databaseErrorMessage(error) };
    }
    console.error("[loginAction] shop.suspendedAt missing — skipping suspend check", error);
  }
  if (shopSuspended && !(await resolveIsSuperAdmin(staff))) {
    await writeAudit({
      actor: {
        id: staff.id,
        email: staff.email,
        role: staff.roleCode,
        shopId: staff.shopId,
      },
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      entityId: staff.id,
      metadata: { reason: "shop_suspended", method: "password" },
    });
    return { error: LOGIN_GENERIC_ERROR };
  }

  try {
    await clearLoginFailures(email);
    const session = await loadStaffSession(staff.id);
    await setSessionCookie(session);
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.authLogin,
      entityType: "Session",
      entityId: staff.id,
      metadata: { method: "password" },
    });
    // Không dùng redirect() trong useActionState — React production #441.
    return { redirectTo: postAuthPath(session, nextPath) };
  } catch (error) {
    console.error("[loginAction] session after password failed", error);
    return { error: "Đăng nhập được nhưng không mở được trang. Thử lại." };
  }
}

export async function logoutAction(formData?: FormData) {
  const reason = String(formData?.get("reason") ?? "manual");
  const session = await getSession();
  if (session) {
    await writeAudit({
      actor: session,
      action:
        reason === "idle" ? AUDIT_ACTIONS.authSessionTimeout : AUDIT_ACTIONS.authLogout,
      entityType: "Session",
      entityId: session.staffId,
      metadata: {
        actorName: session.name,
        reason: reason === "idle" ? "idle_30m" : "manual",
      },
    });
  }
  await clearSessionCookie();
  redirect(reason === "idle" ? "/login?reason=idle" : "/login");
}
