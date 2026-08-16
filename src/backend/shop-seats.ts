import { prisma } from "@/backend/prisma";
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
  const active = await countActiveShopUsers(shopId, options?.excludeStaffId);
  if (canAddActiveShopSeat(active)) {
    return null;
  }
  return shopSeatLimitMessage(MAX_USERS_PER_SHOP);
}
