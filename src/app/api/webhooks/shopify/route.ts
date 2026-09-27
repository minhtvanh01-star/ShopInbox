import { NextResponse } from "next/server";
import { getShopifyOAuthConfig } from "@/backend/oauth-config";
import { verifyShopifyWebhookHmac } from "@/backend/shopify-oauth";
import { processShopifyWebhook } from "@/backend/webhook-shopify";

export async function POST(request: Request) {
  const config = getShopifyOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyWebhookHmac(rawBody, hmac, config.apiSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";
  await processShopifyWebhook({ topic, shopDomain });
  return new NextResponse(null, { status: 200 });
}
