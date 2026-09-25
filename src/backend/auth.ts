import { redirect } from "next/navigation";
import { prisma } from "@/backend/prisma";
import { getSession, hasRevokedSessionCookie, type SessionPayload } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { normalizeRoleCode } from "@/lib/rbac-catalog";

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
      sessionVersion: true,
    },
  });
  if (!staff.isActive) {
    throw new Error("Tài khoản đã bị vô hiệu hóa.");
  }
  return {
    ...toSessionPayload(staff),
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
