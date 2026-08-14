import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/backend/session";
import { saveOAuthConnection } from "@/backend/channel-connect";
import {
  exchangeMetaCode,
  exchangeMetaLongLivedToken,
  fetchMetaPages,
  filterMetaPagesForChannel,
  pickMetaPageForChannel,
} from "@/backend/meta-oauth";
import { getMetaOAuthConfig } from "@/backend/oauth-config";
import {
  OAUTH_PAGES_COOKIE,
  OAUTH_STATE_COOKIE,
  createOAuthPagesToken,
  verifyOAuthStateToken,
} from "@/backend/oauth-state";
import type { Channel } from "@/lib/types";

function settingsUrl(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.redirect(new URL("/login?next=/settings", request.url));
  }

  const config = getMetaOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      settingsUrl(request, { oauth_error: "meta_not_configured" }),
    );
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      settingsUrl(request, { oauth_error: "meta_denied", channel: searchParams.get("state") ?? "" }),
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "meta_invalid" }));
  }

  const jar = await cookies();
  const storedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "meta_state" }));
  }

  const statePayload = await verifyOAuthStateToken(state);
  if (!statePayload || statePayload.shopId !== session.shopId) {
    return NextResponse.redirect(settingsUrl(request, { oauth_error: "meta_state" }));
  }

  const channel = statePayload.channel as Channel;

  try {
    const shortToken = await exchangeMetaCode(config, code);
    const longLived = await exchangeMetaLongLivedToken(config, shortToken);
    const pages = filterMetaPagesForChannel(channel, await fetchMetaPages(longLived.accessToken));

    if (pages.length === 0) {
      return NextResponse.redirect(
        settingsUrl(request, {
          oauth_error: channel === "instagram" ? "meta_no_instagram" : "meta_no_pages",
          channel,
        }),
      );
    }

    if (pages.length === 1) {
      const picked = pickMetaPageForChannel(channel, pages[0]!);
      await saveOAuthConnection({
        shopId: session.shopId,
        channel,
        displayName: picked.displayName,
        accessToken: picked.accessToken,
        expiresAt: longLived.expiresAt,
        pageId: picked.externalId,
      });

      const response = NextResponse.redirect(
        settingsUrl(request, { oauth_success: channel }),
      );
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const pagesToken = await createOAuthPagesToken({
      shopId: session.shopId,
      channel,
      pages,
    });

    const response = NextResponse.redirect(
      settingsUrl(request, { oauth_pick: channel }),
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.set(OAUTH_PAGES_COOKIE, pagesToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 15,
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "meta_failed";
    return NextResponse.redirect(
      settingsUrl(request, { oauth_error: "meta_failed", oauth_message: message, channel }),
    );
  }
}
