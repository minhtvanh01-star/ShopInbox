import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/backend/session";

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireOwner(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "owner") {
    redirect("/inbox");
  }
  return session;
}

export async function requireOwnerApi(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return null;
  }
  return session;
}
