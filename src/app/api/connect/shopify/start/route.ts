import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/backend/rbac";
import { markChannelConnecting } from "@/backend/channel-connect";
import { getShopifyOAuthConfig, isUsableOAuthRedirectUri } from "@/backend/oauth-config";
import { OAUTH_STATE_COOKIE, createOAuthStateToken } from "@/backend/oauth-state";
import { absoluteAppUrl, getRequestOrigin } from "@/backend/public-url";
import { buildShopifyOAuthUrl, normalizeShopifyShopDomain } from "@/backend/shopify-oauth";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export async function GET(request: Request) {
  const session = await requirePermissionApi(PERMISSION_CODES.channelsConnect);
  if (!session) {
    return NextResponse.json({ error: "Không có quyền kết nối kênh" }, { status: 403 });
  }

  const config = getShopifyOAuthConfig(getRequestOrigin(request));
  if (!config || !isUsableOAuthRedirectUri(config.redirectUri)) {
    return NextResponse.redirect(
      absoluteAppUrl(request, "/settings?oauth_error=shopify_not_configured"),
    );
  }

  const shopDomain = normalizeShopifyShopDomain(new URL(request.url).searchParams.get("shop"));
  if (!shopDomain) {
    return NextResponse.redirect(absoluteAppUrl(request, "/settings?oauth_error=shopify_invalid"));
  }

  await markChannelConnecting(session.shopId, "shopify");

  const state = await createOAuthStateToken({
    shopId: session.shopId,
    channel: "shopify",
    nonce: crypto.randomUUID(),
    shopDomain,
  });

  const response = NextResponse.redirect(buildShopifyOAuthUrl(config, shopDomain, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
  return response;
}
