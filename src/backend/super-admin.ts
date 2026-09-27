import { redirect } from "next/navigation";
import { requireSession } from "@/backend/auth";
import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import type { SessionPayload } from "@/backend/session-token";
import { isSuperAdminSession, shouldBootstrapSuperAdmin } from "@/lib/super-admin";

async function countSuperAdmins() {
  try {
    return await prisma.staff.count({ where: { isSuperAdmin: true } });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    return 0;
  }
}

/** Gán Super admin lần đầu: SUPER_ADMIN_EMAIL hoặc chủ shop đầu tiên. */
export async function resolveIsSuperAdmin(staff: {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  roleCode?: string;
}) {
  if (staff.isSuperAdmin) return true;
  const existingSuperAdminCount = await countSuperAdmins();
  if (
    !shouldBootstrapSuperAdmin({
      ...staff,
      existingSuperAdminCount,
    })
  ) {
    return false;
  }
  try {
    const granted = await prisma.$executeRaw`
      UPDATE "staff"
      SET "isSuperAdmin" = true
      WHERE id = ${staff.id}
        AND "isSuperAdmin" = false
        AND NOT EXISTS (SELECT 1 FROM "staff" WHERE "isSuperAdmin" = true)
    `;
    return Number(granted) === 1;
  } catch (error) {
    console.error("[resolveIsSuperAdmin] could not write flag — using bootstrap rule", error);
    return shouldBootstrapSuperAdmin({
      ...staff,
      existingSuperAdminCount,
    });
  }
}

export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isSuperAdminSession(session)) {
    redirect("/inbox");
  }
  return session;
}
