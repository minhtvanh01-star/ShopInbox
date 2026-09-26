import { redirect } from "next/navigation";
import { requireSession } from "@/backend/auth";
import { prisma } from "@/backend/prisma";
import type { SessionPayload } from "@/backend/session-token";
import { isSuperAdminSession, shouldBootstrapSuperAdmin } from "@/lib/super-admin";

/** Gán Super admin lần đầu từ SUPER_ADMIN_EMAIL khi DB chưa có ai — atomic. */
export async function resolveIsSuperAdmin(staff: {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}) {
  if (staff.isSuperAdmin) return true;
  if (!shouldBootstrapSuperAdmin({ ...staff, existingSuperAdminCount: 0 })) {
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
    console.error("[resolveIsSuperAdmin] could not write flag — using email allowlist", error);
    return shouldBootstrapSuperAdmin({ ...staff, existingSuperAdminCount: 0 });
  }
}

export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isSuperAdminSession(session)) {
    redirect("/inbox");
  }
  return session;
}
