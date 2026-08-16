import { prisma } from "@/backend/prisma";
import { isMissingDbColumnError } from "@/backend/prisma-errors";
import {
  DEFAULT_SHOP_POLICY,
  type ShopPolicy,
} from "@/lib/shop-policy";

export async function getShopPolicy(shopId: string): Promise<ShopPolicy> {
  try {
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
      replyClaimTtlMinutes:
        shop.replyClaimTtlMinutes || DEFAULT_SHOP_POLICY.replyClaimTtlMinutes,
      maxUsersPerShop: shop.maxUsersPerShop || DEFAULT_SHOP_POLICY.maxUsersPerShop,
    };
  } catch (error) {
    if (
      isMissingDbColumnError(error, "replyClaimTtlMinutes") ||
      isMissingDbColumnError(error, "maxUsersPerShop")
    ) {
      console.error("[getShopPolicy] missing shop policy columns — using defaults", error);
      return { ...DEFAULT_SHOP_POLICY };
    }
    throw error;
  }
}
