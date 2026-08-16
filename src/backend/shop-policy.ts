import { prisma } from "@/backend/prisma";
import {
  DEFAULT_SHOP_POLICY,
  type ShopPolicy,
} from "@/lib/shop-policy";

export async function getShopPolicy(shopId: string): Promise<ShopPolicy> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      replyClaimTtlMinutes: true,
      maxUsersPerShop: true,
    },
  });
  if (!shop) {
    return { ...DEFAULT_SHOP_POLICY };
  }
  return {
    replyClaimTtlMinutes: shop.replyClaimTtlMinutes || DEFAULT_SHOP_POLICY.replyClaimTtlMinutes,
    maxUsersPerShop: shop.maxUsersPerShop || DEFAULT_SHOP_POLICY.maxUsersPerShop,
  };
}
