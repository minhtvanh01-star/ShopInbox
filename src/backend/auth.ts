import { redirect } from "next/navigation";
import { prisma } from "@/backend/prisma";
import { getSession, hasRevokedSessionCookie, type SessionPayload } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { normalizeRoleCode } from "@/lib/rbac-catalog";
import { isSuperAdminEmail } from "@/lib/super-admin";

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (session) {
    return session;
  }
  if (await hasRevokedSessionCookie()) {
    redirect("/login?reason=revoked");
  }
  redirect("/login");
}

export async function loadStaffSession(staffId: string): Promise<SessionPayload> {
  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: staffId },
    select: {
      id: true,
      shopId: true,
      email: true,
      name: true,
      roleCode: true,
      isActive: true,
      isSuperAdmin: true,
      sessionVersion: true,
      shop: { select: { setupCompletedAt: true, suspendedAt: true } },
    },
  });
  if (!staff.isActive) {
    throw new Error("Tài khoản đã bị vô hiệu hóa.");
  }
  const isSuperAdmin = staff.isSuperAdmin || isSuperAdminEmail(staff.email);
  if (isSuperAdmin && !staff.isSuperAdmin) {
    await prisma.staff.update({
      where: { id: staff.id },
      data: { isSuperAdmin: true },
    });
  }
  if (staff.shop.suspendedAt && !isSuperAdmin) {
    throw new Error("Shop đã bị tạm khóa.");
  }
  return {
    ...toSessionPayload({
      ...staff,
      shopSetupComplete: Boolean(staff.shop.setupCompletedAt),
      isSuperAdmin,
    }),
    lastActiveAt: Date.now(),
  };
}

export async function bumpStaffSessionVersion(staffId: string) {
  await prisma.staff.update({
    where: { id: staffId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export { normalizeRoleCode };
