import { redirect } from "next/navigation";
import { requireSession } from "@/backend/auth";
import { prisma } from "@/backend/prisma";
import { getSession } from "@/backend/session";
import type { SessionPayload } from "@/backend/session-token";
import { isAdminRole, normalizeRoleCode } from "@/lib/rbac-catalog";

const CACHE_TTL_MS = 15_000;

type PermissionCacheEntry = {
  shopId: string;
  codes: string[];
  expiresAt: number;
};

const permissionCache = new Map<string, PermissionCacheEntry>();

export function invalidatePermissionCache(staffId?: string) {
  if (staffId) {
    permissionCache.delete(staffId);
    return;
  }
  permissionCache.clear();
}

export function hasPermissionCodes(granted: readonly string[], code: string): boolean {
  return granted.includes(code);
}

async function loadStaffPermissions(staffId: string): Promise<PermissionCacheEntry | null> {
  const cached = permissionCache.get(staffId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      shopId: true,
      isActive: true,
      role: {
        select: {
          isActive: true,
          permissions: { select: { permissionCode: true } },
        },
      },
    },
  });

  if (!staff || !staff.isActive) return null;

  const codes =
    staff.role?.isActive === true
      ? staff.role.permissions.map((item) => item.permissionCode)
      : [];

  const entry: PermissionCacheEntry = {
    shopId: staff.shopId,
    codes,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  permissionCache.set(staffId, entry);
  return entry;
}

export async function getPermissionCodes(session: SessionPayload): Promise<string[]> {
  const entry = await loadStaffPermissions(session.staffId);
  if (!entry || entry.shopId !== session.shopId) return [];
  return entry.codes;
}

export async function hasPermission(session: SessionPayload, code: string): Promise<boolean> {
  const codes = await getPermissionCodes(session);
  return hasPermissionCodes(codes, code);
}

async function enforcePermission(session: SessionPayload, code: string): Promise<SessionPayload> {
  if (!(await hasPermission(session, code))) {
    redirect("/settings/profile");
  }
  return session;
}

export async function requirePermission(code: string): Promise<SessionPayload>;
export async function requirePermission(session: SessionPayload, code: string): Promise<SessionPayload>;
export async function requirePermission(
  sessionOrCode: SessionPayload | string,
  code?: string,
): Promise<SessionPayload> {
  if (typeof sessionOrCode === "string") {
    const session = await requireSession();
    return enforcePermission(session, sessionOrCode);
  }
  return enforcePermission(sessionOrCode, code ?? "");
}

/**
 * Cho Server Actions: thiếu quyền → throw (không redirect).
 * redirect() trong action POST dễ thành 500 / vòng lặp client retry.
 */
export async function requireActionPermission(code: string): Promise<SessionPayload> {
  const session = await requireSession();
  if (!(await hasPermission(session, code))) {
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
  }
  return session;
}

export async function requirePermissionApi(code: string): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !(await hasPermission(session, code))) {
    return null;
  }
  return session;
}

export function sessionRoleCode(session: SessionPayload): string {
  return normalizeRoleCode(session.role);
}

export function isAdminSession(session: { role: string }): boolean {
  return isAdminRole(sessionRoleCode(session as SessionPayload));
}
