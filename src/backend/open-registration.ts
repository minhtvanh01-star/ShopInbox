import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/backend/prisma";
import { planOpenRegistration, REGISTER_DEFAULT_SHOP_ID } from "@/backend/register";
import { getShopPolicy } from "@/backend/shop-policy";
import { shopSeatLimitMessage } from "@/lib/shop-seats";
import { normalizeRoleCode } from "@/lib/rbac-catalog";

const OPEN_REGISTRATION_LOCK_KEY = 87231001;

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
}): Promise<{ ok: true; staff: OpenRegistrationStaff } | { ok: false; error: string }> {
  try {
    return await withOpenRegistrationLock(async (tx) => {
      const [staffCount, shop, existing] = await Promise.all([
        tx.staff.count(),
        tx.shop.findUnique({
          where: { id: REGISTER_DEFAULT_SHOP_ID },
          select: { id: true },
        }),
        tx.staff.findUnique({
          where: { email: input.email },
          select: { id: true },
        }),
      ]);

      const plan = planOpenRegistration({
        staffCount,
        shopExists: Boolean(shop),
        emailTaken: Boolean(existing),
      });
      if (!plan.ok) {
        return { ok: false, error: plan.error };
      }

      if (plan.createShop) {
        await tx.shop.create({
          data: { id: plan.createShop.id, name: plan.createShop.name },
        });
      }

      const [total, active] = await Promise.all([
        tx.staff.count({ where: { shopId: plan.shopId } }),
        tx.staff.count({ where: { shopId: plan.shopId, isActive: true } }),
      ]);
      const policy = await getShopPolicy(plan.shopId);
      if (total >= policy.maxUsersPerShop || (plan.isActive && active >= policy.maxUsersPerShop)) {
        return { ok: false, error: shopSeatLimitMessage(policy.maxUsersPerShop) };
      }

      const staff = await tx.staff.create({
        data: {
          id: `staff-${crypto.randomUUID()}`,
          shopId: plan.shopId,
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash ?? null,
          googleId: input.googleId ?? null,
          avatarUrl: input.avatarUrl ?? null,
          roleCode: normalizeRoleCode(plan.role),
          isActive: plan.isActive,
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
