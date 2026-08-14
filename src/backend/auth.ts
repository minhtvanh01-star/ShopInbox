import { redirect } from "next/navigation";
import { prisma } from "@/backend/prisma";
import { getSession, type SessionPayload } from "@/backend/session";
import { toSessionPayload } from "@/backend/session-token";
import { normalizeRoleCode } from "@/lib/rbac-catalog";

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
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
    },
  });
  return toSessionPayload(staff);
}

export { normalizeRoleCode };
