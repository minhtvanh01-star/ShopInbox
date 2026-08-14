import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/backend/auth";
import { markChannelConnecting } from "@/backend/channel-connect";
import { buildZaloOAuthUrl } from "@/backend/zalo-oauth";
import { getZaloOAuthConfig } from "@/backend/oauth-config";
import {
  OAUTH_STATE_COOKIE,
  createOAuthStateToken,
} from "@/backend/oauth-state";

export async function GET(request: Request) {
  const session = await requireOwnerApi();
  if (!session) {
    return NextResponse.json({ error: "Chỉ chủ shop mới kết nối kênh" }, { status: 403 });
  }

  const config = getZaloOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=zalo_not_configured", request.url),
    );
  }

  await markChannelConnecting(session.shopId, "zalo");

  const state = await createOAuthStateToken({
    shopId: session.shopId,
    channel: "zalo",
    nonce: crypto.randomUUID(),
  });

  const response = NextResponse.redirect(buildZaloOAuthUrl(config, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
