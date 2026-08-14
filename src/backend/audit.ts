import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/backend/prisma";
import type { SessionPayload } from "@/backend/session-token";

const SECRET_KEY = /password|token|secret|authorization|cookie|hash|refresh/i;

export type AuditActor = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  shopId?: string | null;
};

export type WriteAuditInput = {
  actor?: AuditActor | SessionPayload | null;
  shopId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

function actorFrom(input: WriteAuditInput): {
  shopId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
} {
  const actor = input.actor;
  const session =
    actor && "staffId" in actor
      ? {
          id: actor.staffId,
          email: actor.email,
          role: actor.role,
          shopId: actor.shopId,
        }
      : actor;

  return {
    shopId: input.shopId ?? session?.shopId ?? null,
    actorId: input.actorId ?? session?.id ?? null,
    actorEmail: input.actorEmail ?? session?.email ?? null,
    actorRole: input.actorRole ?? session?.role ?? null,
  };
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof value === "string" && value.length > 2000) {
      cleaned[key] = `${value.slice(0, 2000)}…`;
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

export function auditMetaFromRequest(request: Request): { ip?: string; userAgent?: string } {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}

export async function readAuditRequestMeta(): Promise<{ ip?: string; userAgent?: string }> {
  try {
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
      userAgent: h.get("user-agent") || undefined,
    };
  } catch {
    return {};
  }
}

/** Ghi nhật ký — lỗi insert không làm hỏng thao tác chính. */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  try {
    const actor = actorFrom(input);
    const reqMeta =
      input.ip || input.userAgent ? { ip: input.ip, userAgent: input.userAgent } : await readAuditRequestMeta();

    await prisma.auditLog.create({
      data: {
        shopId: actor.shopId,
        actorId: actor.actorId,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: sanitizeAuditMetadata(input.metadata) as Prisma.InputJsonValue | undefined,
        ip: reqMeta.ip ?? null,
        userAgent: reqMeta.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] write failed", error);
  }
}
