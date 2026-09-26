import { prisma } from "@/backend/prisma";
import { BOOTSTRAP_ROLE_CODE } from "@/lib/rbac-catalog";
import type { ShopOpsInput, ShopPlanCode, ShopSupportStatusCode } from "@/lib/shop-ops";

export type PlatformShopFilters = {
  plan?: ShopPlanCode | null;
  support?: ShopSupportStatusCode | null;
};

export async function listPlatformShops(filters: PlatformShopFilters = {}) {
  const shops = await prisma.shop.findMany({
    where: {
      ...(filters.plan ? { planCode: filters.plan } : {}),
      ...(filters.support ? { supportStatus: filters.support } : {}),
    },
    orderBy: [{ supportStatus: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { staff: true, channelAccounts: true, orders: true },
      },
      staff: {
        where: { roleCode: BOOTSTRAP_ROLE_CODE },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, name: true, email: true, isSuperAdmin: true },
      },
    },
  });

  return shops.map((shop) => ({
    id: shop.id,
    name: shop.name,
    createdAt: shop.createdAt,
    setupCompletedAt: shop.setupCompletedAt,
    suspendedAt: shop.suspendedAt,
    planCode: shop.planCode,
    planExpiresAt: shop.planExpiresAt,
    supportStatus: shop.supportStatus,
    supportTopic: shop.supportTopic,
    supportNote: shop.supportNote,
    staffCount: shop._count.staff,
    channelCount: shop._count.channelAccounts,
    orderCount: shop._count.orders,
    owner: shop.staff[0] ?? null,
  }));
}

export async function getPlatformShopDetail(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      staff: {
        orderBy: [{ isSuperAdmin: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          roleCode: true,
          isActive: true,
          isSuperAdmin: true,
          createdAt: true,
        },
      },
      channelAccounts: {
        select: { id: true, channel: true, status: true, displayName: true, name: true },
      },
      _count: { select: { customers: true, orders: true, conversations: true } },
    },
  });
  return shop;
}

export async function setShopSuspended(shopId: string, suspended: boolean) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } });
  if (!shop) return { ok: false as const, error: "Không tìm thấy shop." };
  await prisma.shop.update({
    where: { id: shopId },
    data: { suspendedAt: suspended ? new Date() : null },
  });
  if (suspended) {
    await prisma.staff.updateMany({
      where: { shopId },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  return { ok: true as const };
}

export async function setStaffSuperAdmin(staffId: string, next: boolean, actorStaffId: string) {
  const target = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, isSuperAdmin: true, email: true, isActive: true },
  });
  if (!target) return { ok: false as const, error: "Không tìm thấy tài khoản." };

  if (next && !target.isActive) {
    return { ok: false as const, error: "Chỉ gán Super admin cho tài khoản đang hoạt động." };
  }

  if (!next) {
    if (target.id === actorStaffId) {
      return { ok: false as const, error: "Không thể tự bỏ quyền Super admin." };
    }
    const others = await prisma.staff.count({
      where: { isSuperAdmin: true, isActive: true, id: { not: target.id } },
    });
    if (others === 0) {
      return { ok: false as const, error: "Phải còn ít nhất một Super admin đang hoạt động." };
    }
  }

  if (target.isSuperAdmin === next) {
    return { ok: true as const, email: target.email };
  }

  await prisma.staff.update({
    where: { id: target.id },
    data: { isSuperAdmin: next, sessionVersion: { increment: 1 } },
  });
  return { ok: true as const, email: target.email };
}

export async function updateShopOps(shopId: string, input: ShopOpsInput) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } });
  if (!shop) return { ok: false as const, error: "Không tìm thấy shop." };
  await prisma.shop.update({
    where: { id: shopId },
    data: {
      planCode: input.planCode,
      planExpiresAt: input.planExpiresAt,
      supportStatus: input.supportStatus,
      supportTopic: input.supportTopic,
      supportNote: input.supportNote,
    },
  });
  return { ok: true as const };
}
