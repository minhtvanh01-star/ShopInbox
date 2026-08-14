import { SignJWT, jwtVerify } from "jose";
import type { MetaPageOption } from "@/lib/oauth-types";
import type { Channel } from "@/lib/types";

const OAUTH_STATE_COOKIE = "shopinbox_oauth_state";
const OAUTH_PAGES_COOKIE = "shopinbox_oauth_pages";

export { OAUTH_STATE_COOKIE, OAUTH_PAGES_COOKIE };

export type OAuthStatePayload = {
  shopId: string;
  channel: Channel;
  nonce: string;
};

export type { MetaPageOption } from "@/lib/oauth-types";

export type OAuthPagesPayload = {
  shopId: string;
  channel: Channel;
  pages: MetaPageOption[];
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("Thiếu SESSION_SECRET (tối thiểu 16 ký tự) trong .env");
  }
  return new TextEncoder().encode(secret);
}

export async function createOAuthStateToken(payload: OAuthStatePayload) {
  return new SignJWT({
    shopId: payload.shopId,
    channel: payload.channel,
    nonce: payload.nonce,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function verifyOAuthStateToken(token: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.shopId !== "string" ||
      typeof payload.channel !== "string" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }

    const channel = payload.channel;
    if (channel !== "facebook" && channel !== "instagram" && channel !== "zalo") {
      return null;
    }

    return {
      shopId: payload.shopId,
      channel,
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

export async function createOAuthPagesToken(payload: OAuthPagesPayload) {
  return new SignJWT({
    shopId: payload.shopId,
    channel: payload.channel,
    pages: payload.pages,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function verifyOAuthPagesToken(token: string): Promise<OAuthPagesPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.shopId !== "string" || typeof payload.channel !== "string") {
      return null;
    }

    const channel = payload.channel;
    if (channel !== "facebook" && channel !== "instagram") {
      return null;
    }

    if (!Array.isArray(payload.pages)) {
      return null;
    }

    const pages: MetaPageOption[] = [];
    for (const item of payload.pages) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as MetaPageOption).pageId !== "string" ||
        typeof (item as MetaPageOption).pageName !== "string" ||
        typeof (item as MetaPageOption).pageAccessToken !== "string"
      ) {
        continue;
      }
      const page = item as MetaPageOption;
      pages.push({
        pageId: page.pageId,
        pageName: page.pageName,
        pageAccessToken: page.pageAccessToken,
        instagramId: typeof page.instagramId === "string" ? page.instagramId : undefined,
        instagramUsername:
          typeof page.instagramUsername === "string" ? page.instagramUsername : undefined,
      });
    }

    if (pages.length === 0) {
      return null;
    }

    return { shopId: payload.shopId, channel, pages };
  } catch {
    return null;
  }
}
