import { prisma } from "@/backend/prisma";

const GDPR_TOPICS = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

export async function processShopifyWebhook(input: {
  topic: string;
  shopDomain: string;
}) {
  const topic = input.topic.trim();
  const shopDomain = input.shopDomain.trim().toLowerCase();
  if (!shopDomain) return { handled: false as const };

  if (GDPR_TOPICS.has(topic)) {
    console.info("[webhook/shopify] gdpr acknowledged", { topic, shop: shopDomain });
    return { handled: true as const };
  }

  if (topic === "app/uninstalled") {
    await prisma.channelAccount.updateMany({
      where: { channel: "shopify", pageId: shopDomain },
      data: {
        status: "disconnected",
        accessToken: null,
        refreshToken: null,
        connectedAt: null,
        note: "Shopify đã gỡ app. Nối lại cửa hàng để tiếp tục.",
      },
    });
    return { handled: true as const };
  }

  await prisma.channelAccount.updateMany({
    where: { channel: "shopify", pageId: shopDomain },
    data: { lastWebhookAt: new Date() },
  });
  return { handled: true as const };
}
