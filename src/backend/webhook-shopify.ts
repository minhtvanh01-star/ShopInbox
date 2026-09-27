import { prisma } from "@/backend/prisma";

const GDPR_ACK_TOPICS = new Set(["customers/data_request", "customers/redact"]);

async function disconnectShopifyStore(shopDomain: string, note: string) {
  await prisma.channelAccount.updateMany({
    where: { channel: "shopify", pageId: shopDomain },
    data: {
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      connectedAt: null,
      note,
    },
  });
}

export async function processShopifyWebhook(input: {
  topic: string;
  shopDomain: string;
}) {
  const topic = input.topic.trim();
  const shopDomain = input.shopDomain.trim().toLowerCase();
  if (!shopDomain) return { handled: false as const };

  if (GDPR_ACK_TOPICS.has(topic)) {
    console.info("[webhook/shopify] gdpr acknowledged", { topic, shop: shopDomain });
    return { handled: true as const };
  }

  if (topic === "shop/redact") {
    await disconnectShopifyStore(
      shopDomain,
      "Shopify yêu cầu xóa dữ liệu cửa hàng (shop/redact).",
    );
    return { handled: true as const };
  }

  if (topic === "app/uninstalled") {
    await disconnectShopifyStore(shopDomain, "Shopify đã gỡ app. Nối lại cửa hàng để tiếp tục.");
    return { handled: true as const };
  }

  await prisma.channelAccount.updateMany({
    where: { channel: "shopify", pageId: shopDomain },
    data: { lastWebhookAt: new Date() },
  });
  return { handled: true as const };
}
