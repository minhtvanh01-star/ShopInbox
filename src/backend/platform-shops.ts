import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { BOOTSTRAP_ROLE_CODE } from "@/lib/rbac-catalog";
import type { ShopOpsInput, ShopPlanCode, ShopSupportStatusCode } from "@/lib/shop-ops";

export type PlatformShopFilters = {
  plan?: ShopPlanCode | null;
  support?: ShopSupportStatusCode | null;
};

const shopCountSelect = {
  staff: true,
  channelAccounts: true,
  orders: true,
} as const;

const ownerSelect = {
  where: { roleCode: BOOTSTRAP_ROLE_CODE },
  orderBy: { createdAt: "asc" as const },
  take: 1,
};

function mapPlatformShopRow(shop: {
  id: string;
  name: string;
  createdAt: Date;
  setupCompletedAt?: Date | null;
  suspendedAt?: Date | null;
  planCode?: ShopPlanCode | null;
  planExpiresAt?: Date | null;
  supportStatus?: ShopSupportStatusCode | null;
  supportTopic?: string | null;
  supportNote?: string | null;
  _count: { staff: number; channelAccounts: number; orders: number };
  staff: Array<{ id: string; name: string; email: string; isSuperAdmin?: boolean }>;
}) {
  return {
    id: shop.id,
    name: shop.name,
    createdAt: shop.createdAt,
    setupCompletedAt: shop.setupCompletedAt ?? null,
    suspendedAt: shop.suspendedAt ?? null,
    planCode: shop.planCode ?? ("trial" as const),
    planExpiresAt: shop.planExpiresAt ?? null,
    supportStatus: shop.supportStatus ?? ("ok" as const),
    supportTopic: shop.supportTopic ?? "none",
    supportNote: shop.supportNote ?? "",
    staffCount: shop._count.staff,
    channelCount: shop._count.channelAccounts,
    orderCount: shop._count.orders,
    owner: shop.staff[0] ?? null,
  };
}

export async function listPlatformShops(filters: PlatformShopFilters = {}) {
  try {
    const shops = await prisma.shop.findMany({
      where: {
        ...(filters.plan ? { planCode: filters.plan } : {}),
        ...(filters.support ? { supportStatus: filters.support } : {}),
      },
      orderBy: [{ supportStatus: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        setupCompletedAt: true,
        suspendedAt: true,
        planCode: true,
        planExpiresAt: true,
        supportStatus: true,
        supportTopic: true,
        supportNote: true,
        _count: { select: shopCountSelect },
        staff: {
          ...ownerSelect,
          select: { id: true, name: true, email: true, isSuperAdmin: true },
        },
      },
    });
    return shops.map(mapPlatformShopRow);
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    console.error("[listPlatformShops] shop-ops schema drift — listing without plan/support", error);
    try {
      const shops = await prisma.shop.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          setupCompletedAt: true,
          suspendedAt: true,
          _count: { select: shopCountSelect },
          staff: {
            ...ownerSelect,
            select: { id: true, name: true, email: true },
          },
        },
      });
      return shops.map(mapPlatformShopRow);
    } catch (fallbackError) {
      if (!isPrismaSchemaDriftError(fallbackError)) {
        throw fallbackError;
      }
      const shops = await prisma.shop.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: shopCountSelect },
          staff: {
            ...ownerSelect,
            select: { id: true, name: true, email: true },
          },
        },
      });
      return shops.map(mapPlatformShopRow);
    }
  }
}

const detailCounts = { customers: true, orders: true, conversations: true } as const;
const channelSelect = {
  id: true,
  channel: true,
  status: true,
  displayName: true,
  name: true,
} as const;

export async function getPlatformShopDetail(shopId: string) {
  try {
    return await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        setupCompletedAt: true,
        suspendedAt: true,
        planCode: true,
        planExpiresAt: true,
        supportStatus: true,
        supportTopic: true,
        supportNote: true,
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
        channelAccounts: { select: channelSelect },
        _count: { select: detailCounts },
      },
    });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    console.error("[getPlatformShopDetail] shop-ops schema drift — loading without plan/support", error);
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        setupCompletedAt: true,
        suspendedAt: true,
        staff: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            roleCode: true,
            isActive: true,
            createdAt: true,
          },
        },
        channelAccounts: { select: channelSelect },
        _count: { select: detailCounts },
      },
    });
    if (!shop) return null;
    return {
      ...shop,
      planCode: "trial" as const,
      planExpiresAt: null,
      supportStatus: "ok" as const,
      supportTopic: "none" as const,
      supportNote: "",
      staff: shop.staff.map((member) => ({
        ...member,
        avatarUrl: null as string | null,
        isSuperAdmin: false,
      })),
    };
  }
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
    select: { id: true, isSuperAdmin: true, email: true, isActive: true, shopId: true },
  });
  if (!target) return { ok: false as const, error: "Không tìm thấy tài khoản." };

  if (next && !target.isActive) {
    return { ok: false as const, error: "Chỉ gán Super admin cho tài khoản đang hoạt động." };
  }

  if (!next) {
    if (target.id === actorStaffId) {
      return { ok: false as const, error: "Không thể tự bỏ quyền Super admin." };
    }
    if (target.isSuperAdmin === next) {
      return { ok: true as const, email: target.email, shopId: target.shopId };
    }
    const revoked = await prisma.$executeRaw`
      UPDATE "staff"
      SET "isSuperAdmin" = false, "sessionVersion" = "sessionVersion" + 1
      WHERE id = ${target.id}
        AND "isSuperAdmin" = true
        AND EXISTS (
          SELECT 1 FROM "staff"
          WHERE "isSuperAdmin" = true AND "isActive" = true AND id <> ${target.id}
        )
    `;
    if (Number(revoked) !== 1) {
      return { ok: false as const, error: "Phải còn ít nhất một Super admin đang hoạt động." };
    }
    return { ok: true as const, email: target.email, shopId: target.shopId };
  }

  if (target.isSuperAdmin === next) {
    return { ok: true as const, email: target.email, shopId: target.shopId };
  }

  await prisma.staff.update({
    where: { id: target.id },
    data: { isSuperAdmin: next, sessionVersion: { increment: 1 } },
  });
  return { ok: true as const, email: target.email, shopId: target.shopId };
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
