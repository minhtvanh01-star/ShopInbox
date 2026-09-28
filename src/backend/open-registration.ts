import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/backend/prisma";
import { planOpenRegistration } from "@/backend/register";
import { defaultShopNameFromOwner } from "@/lib/shop-name";
import { BOOTSTRAP_ROLE_CODE, normalizeRoleCode } from "@/lib/rbac-catalog";

export const OPEN_REGISTRATION_LOCK_KEY = 87231001;

async function withOpenRegistrationLock<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${OPEN_REGISTRATION_LOCK_KEY})`;
    return fn(tx);
  });
}

export type OpenRegistrationStaff = {
  id: string;
  email: string;
  name: string;
  shopId: string;
  roleCode: string;
  isActive: boolean;
};

export async function createOpenRegistrationStaff(input: {
  email: string;
  name: string;
  passwordHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}): Promise<{ ok: true; staff: OpenRegistrationStaff } | { ok: false; error: string }> {
  try {
    return await withOpenRegistrationLock(async (tx) => {
      const existing = await tx.staff.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      const plan = planOpenRegistration({ emailTaken: Boolean(existing) });
      if (!plan.ok) {
        return { ok: false, error: plan.error };
      }

      const shop = await tx.shop.create({
        data: {
          id: `shop-${crypto.randomUUID()}`,
          name: defaultShopNameFromOwner(input.name),
        },
        select: { id: true },
      });

      const staff = await tx.staff.create({
        data: {
          id: `staff-${crypto.randomUUID()}`,
          shopId: shop.id,
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash ?? null,
          googleId: input.googleId ?? null,
          avatarUrl: input.avatarUrl ?? null,
          emailVerifiedAt: input.emailVerified ? new Date() : null,
          roleCode: normalizeRoleCode(BOOTSTRAP_ROLE_CODE),
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          shopId: true,
          roleCode: true,
          isActive: true,
        },
      });

      return { ok: true, staff };
    });
  } catch {
    return { ok: false, error: "Email này đã được đăng ký." };
  }
}
