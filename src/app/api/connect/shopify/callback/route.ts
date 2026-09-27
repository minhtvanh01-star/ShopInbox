import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasPermission } from "@/backend/rbac";
import { getSession } from "@/backend/session";
import { auditMetaFromRequest, writeAudit } from "@/backend/audit";
import { saveOAuthConnection } from "@/backend/channel-connect";
import {
  getShopifyOAuthConfig,
  getShopifyWebhookUrl,
  isUsableOAuthRedirectUri,
} from "@/backend/oauth-config";
import { OAUTH_STATE_COOKIE, verifyOAuthStateToken } from "@/backend/oauth-state";
import { absoluteAppUrl, getRequestOrigin } from "@/backend/public-url";
import {
  exchangeShopifyCode,
  fetchShopifyShopName,
  normalizeShopifyShopDomain,
  registerShopifyAppUninstalledWebhook,
  verifyShopifyOAuthHmac,
} from "@/backend/shopify-oauth";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import { sanitizeOAuthFlashMessage } from "@/lib/meta-webhook-security";

function settingsUrl(request: Request, params: Record<string, string>) {
  const url = absoluteAppUrl(request, "/settings");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !(await hasPermission(session, PERMISSION_CODES.channelsConnect))) {
    return NextResponse.redirect(absoluteAppUrl(request, "/login?next=/settings"));
  }

  const origin = getRequestOrigin(request);
  const config = getShopifyOAuthConfig(origin);
  if (!config || !isUsableOAuthRedirectUri(config.redirectUri)) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "shopify_not_configured" }));
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("error")) {
    const response = NextResponse.redirect(settingsUrl(request, { oauth_error: "shopify_denied" }));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  if (!verifyShopifyOAuthHmac(searchParams, config.apiSecret)) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "shopify_invalid" }));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const shopDomain = normalizeShopifyShopDomain(searchParams.get("shop"));
  if (!code || !state || !shopDomain) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "shopify_invalid" }));
  }

  const jar = await cookies();
  const storedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "shopify_state" }));
  }

  const statePayload = await verifyOAuthStateToken(state);
  if (
    !statePayload ||
    statePayload.shopId !== session.shopId ||
    statePayload.channel !== "shopify" ||
    statePayload.shopDomain !== shopDomain
  ) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "shopify_state" }));
  }

  try {
    const token = await exchangeShopifyCode(config, shopDomain, code);
    const displayName = await fetchShopifyShopName(shopDomain, token.accessToken);
    await saveOAuthConnection({
      shopId: session.shopId,
      channel: "shopify",
      displayName,
      accessToken: token.accessToken,
      pageId: shopDomain,
    });
    await registerShopifyAppUninstalledWebhook({
      shopDomain,
      accessToken: token.accessToken,
      address: getShopifyWebhookUrl(),
    });
    await writeAudit({
      ...auditMetaFromRequest(request),
      actor: session,
      action: AUDIT_ACTIONS.channelConnect,
      entityType: "ChannelAccount",
      metadata: { channel: "shopify", displayName, via: "shopify_oauth" },
    });
    const response = NextResponse.redirect(settingsUrl(request, { oauth_success: "shopify" }));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = sanitizeOAuthFlashMessage(
      err instanceof Error ? err.message : "shopify_failed",
    );
    const response = NextResponse.redirect(
      settingsUrl(request, { oauth_error: "shopify_failed", oauth_message: message }),
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
