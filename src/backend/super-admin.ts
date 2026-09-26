import { redirect } from "next/navigation";
import { requireSession } from "@/backend/auth";
import type { SessionPayload } from "@/backend/session-token";
import { isSuperAdminSession } from "@/lib/super-admin";

export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isSuperAdminSession(session)) {
    redirect("/inbox");
  }
  return session;
}
