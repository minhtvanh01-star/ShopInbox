import { NextResponse } from "next/server";
import { writeAudit } from "@/backend/audit";
import { clearSessionCookie, getSession } from "@/backend/session";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";

/** Client idle guard gọi khi tab mở nhưng không thao tác 30 phút. */
export async function POST() {
  const session = await getSession();
  if (session) {
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.authSessionTimeout,
      entityType: "Session",
      entityId: session.staffId,
      metadata: {
        actorName: session.name,
        reason: "idle_30m",
        source: "client_guard",
      },
    });
  }

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
