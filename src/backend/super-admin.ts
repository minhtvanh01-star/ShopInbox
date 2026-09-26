import { redirect } from "next/navigation";
import { requireSession } from "@/backend/auth";
import { prisma } from "@/backend/prisma";
import type { SessionPayload } from "@/backend/session-token";
import { isSuperAdminSession, shouldBootstrapSuperAdmin } from "@/lib/super-admin";

/** Gán Super admin lần đầu từ SUPER_ADMIN_EMAIL khi DB chưa có ai. */
export async function resolveIsSuperAdmin(staff: {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}) {
  if (staff.isSuperAdmin) return true;
  const existingSuperAdminCount = await prisma.staff.count({
    where: { isSuperAdmin: true },
  });
  if (!shouldBootstrapSuperAdmin({ ...staff, existingSuperAdminCount })) {
    return false;
  }
  await prisma.staff.update({
    where: { id: staff.id },
    data: { isSuperAdmin: true },
  });
  return true;
}

export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isSuperAdminSession(session)) {
    redirect("/inbox");
  }
  return session;
}
