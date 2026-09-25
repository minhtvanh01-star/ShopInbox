import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasPermission } from "@/backend/rbac";
import { getSession } from "@/backend/session";
import { auditMetaFromRequest, writeAudit } from "@/backend/audit";
import { saveOAuthConnection } from "@/backend/channel-connect";
import { getZaloOAuthConfig } from "@/backend/oauth-config";
import { OAUTH_STATE_COOKIE, verifyOAuthStateToken } from "@/backend/oauth-state";
import { absoluteAppUrl } from "@/backend/public-url";
import { exchangeZaloCode, fetchZaloOaInfo } from "@/backend/zalo-oauth";
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

  const config = getZaloOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      settingsUrl(request, { oauth_error: "zalo_not_configured" }),
    );
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "zalo_denied" }));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "zalo_invalid" }));
  }

  const jar = await cookies();
  const storedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "zalo_state" }));
  }

  const statePayload = await verifyOAuthStateToken(state);
  if (!statePayload || statePayload.shopId !== session.shopId || statePayload.channel !== "zalo") {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "zalo_state" }));
  }

  try {
    const token = await exchangeZaloCode(config, code, statePayload.codeVerifier);
    const oa = await fetchZaloOaInfo(token.accessToken);

    await saveOAuthConnection({
      shopId: session.shopId,
      channel: "zalo",
      displayName: oa.name,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      oaId: oa.oaId,
    });
    await writeAudit({
      ...auditMetaFromRequest(request),
      actor: session,
      action: AUDIT_ACTIONS.channelConnect,
      entityType: "ChannelAccount",
      metadata: { channel: "zalo", displayName: oa.name, via: "zalo_oauth" },
    });

    const response = NextResponse.redirect(
      settingsUrl(request, { oauth_success: "zalo" }),
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = sanitizeOAuthFlashMessage(
      err instanceof Error ? err.message : "zalo_failed",
    );
    const response = NextResponse.redirect(
      settingsUrl(request, { oauth_error: "zalo_failed", oauth_message: message }),
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
