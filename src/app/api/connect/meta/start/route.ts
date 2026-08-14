import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/backend/auth";
import { markChannelConnecting } from "@/backend/channel-connect";
import { buildMetaOAuthUrl } from "@/backend/meta-oauth";
import { getMetaOAuthConfig } from "@/backend/oauth-config";
import {
  OAUTH_STATE_COOKIE,
  createOAuthStateToken,
} from "@/backend/oauth-state";
import type { Channel } from "@/lib/types";

const META_CHANNELS: Channel[] = ["facebook", "instagram"];

export async function GET(request: Request) {
  const session = await requireOwnerApi();
  if (!session) {
    return NextResponse.json({ error: "Chỉ chủ shop mới kết nối kênh" }, { status: 403 });
  }

  const config = getMetaOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=meta_not_configured", request.url),
    );
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");
  if (!channel || !META_CHANNELS.includes(channel as Channel)) {
    return NextResponse.json({ error: "Kênh Meta không hợp lệ" }, { status: 400 });
  }

  await markChannelConnecting(session.shopId, channel as Channel);

  const state = await createOAuthStateToken({
    shopId: session.shopId,
    channel: channel as Channel,
    nonce: crypto.randomUUID(),
  });

  const response = NextResponse.redirect(buildMetaOAuthUrl(config, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
