import { prisma } from "@/backend/prisma";
import { getShopPolicy } from "@/backend/shop-policy";
import {
  canAddActiveShopSeat,
  MAX_USERS_PER_SHOP,
  shopSeatLimitMessage,
} from "@/lib/shop-seats";

export { MAX_USERS_PER_SHOP, shopSeatLimitMessage };

/** Đếm thành viên đang active của shop. */
export async function countActiveShopUsers(shopId: string, excludeStaffId?: string) {
  return prisma.staff.count({
    where: {
      shopId,
      isActive: true,
      ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}),
    },
  });
}

/**
 * Chặn thêm/kích hoạt khi đã đủ ghế.
 * @returns null nếu còn ghế; chuỗi lỗi tiếng Việt nếu hết.
 */
export async function assertShopHasActiveSeat(
  shopId: string,
  options?: { excludeStaffId?: string },
): Promise<string | null> {
  const [active, policy] = await Promise.all([
    countActiveShopUsers(shopId, options?.excludeStaffId),
    getShopPolicy(shopId),
  ]);
  if (canAddActiveShopSeat(active, policy.maxUsersPerShop)) {
    return null;
  }
  return shopSeatLimitMessage(policy.maxUsersPerShop);
}

export async function getShopMaxUsers(shopId: string) {
  const policy = await getShopPolicy(shopId);
  return policy.maxUsersPerShop;
}
