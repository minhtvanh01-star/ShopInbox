import { redirect } from "next/navigation";
import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { getSession, hasRevokedSessionCookie, type SessionPayload } from "@/backend/session";
import { sessionVersionOf } from "@/backend/session-live";
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
  let staff: {
    id: string;
    shopId: string;
    email: string;
    name: string;
    roleCode: string;
    isActive: boolean;
    isSuperAdmin: boolean;
    sessionVersion: number;
    shop: { setupCompletedAt: Date | null; suspendedAt: Date | null };
  };
  try {
    staff = await prisma.staff.findUniqueOrThrow({
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
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    const basic = await prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
      select: {
        id: true,
        shopId: true,
        email: true,
        name: true,
        roleCode: true,
        isActive: true,
      },
    });
    staff = {
      ...basic,
      isSuperAdmin: false,
      sessionVersion: sessionVersionOf(undefined),
      shop: { setupCompletedAt: new Date(0), suspendedAt: null },
    };
  }
  if (!staff.isActive) {
    throw new Error("Tài khoản đã bị vô hiệu hóa.");
  }
  const { resolveIsSuperAdmin } = await import("@/backend/super-admin");
  const isSuperAdmin = await resolveIsSuperAdmin(staff);
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
