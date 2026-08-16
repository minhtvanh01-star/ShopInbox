"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/backend/audit";
import { prisma } from "@/backend/prisma";
import { verifyPassword } from "@/backend/password";
import { toSessionPayload } from "@/backend/session-token";
import { clearSessionCookie, getSession, setSessionCookie } from "@/backend/session";
import { safeInternalPath } from "@/backend/safe-path";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";

export type AuthActionState = {
  error?: string;
  success?: string;
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

  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) {
    await writeAudit({
      actorEmail: email,
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      metadata: { reason: "not_found", method: "password" },
    });
    return { error: "Email hoặc mật khẩu không đúng." };
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
    return { error: "Tài khoản này đăng nhập bằng Google." };
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
    return { error: "Tài khoản chưa được kích hoạt hoặc đã bị tắt. Liên hệ quản trị viên để phê duyệt và phân quyền." };
  }

  const ok = await verifyPassword(password, staff.passwordHash);
  if (!ok) {
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
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  const session = toSessionPayload(staff);
  await setSessionCookie(session);
  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.authLogin,
    entityType: "Session",
    entityId: staff.id,
    metadata: { method: "password" },
  });

  redirect(nextPath);
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
