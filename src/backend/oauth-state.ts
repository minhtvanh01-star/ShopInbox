import { SignJWT, jwtVerify } from "jose";
import { sessionSecretBytes } from "@/backend/app-secret";
import { prisma } from "@/backend/prisma";
import { openSecret, sealSecret } from "@/backend/token-crypto";
import type { MetaPageOption } from "@/lib/oauth-types";
import type { Channel } from "@/lib/types";

const OAUTH_STATE_COOKIE = "shopinbox_oauth_state";
const OAUTH_PAGES_COOKIE = "shopinbox_oauth_pages";

export { OAUTH_STATE_COOKIE, OAUTH_PAGES_COOKIE };

export type OAuthStatePayload = {
  shopId: string;
  channel: Channel;
  nonce: string;
  codeVerifier?: string;
  shopDomain?: string;
};

export type { MetaPageOption } from "@/lib/oauth-types";

export type OAuthPagesPayload = {
  shopId: string;
  channel: Channel;
  pages: MetaPageOption[];
};

function getSecret() {
  return sessionSecretBytes();
}

export async function createOAuthStateToken(payload: OAuthStatePayload) {
  return new SignJWT({
    shopId: payload.shopId,
    channel: payload.channel,
    nonce: payload.nonce,
    ...(payload.codeVerifier ? { codeVerifier: payload.codeVerifier } : {}),
    ...(payload.shopDomain ? { shopDomain: payload.shopDomain } : {}),
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
    if (
      channel !== "facebook" &&
      channel !== "instagram" &&
      channel !== "zalo" &&
      channel !== "shopify"
    ) {
      return null;
    }

    return {
      shopId: payload.shopId,
      channel,
      nonce: payload.nonce,
      codeVerifier: typeof payload.codeVerifier === "string" ? payload.codeVerifier : undefined,
      shopDomain: typeof payload.shopDomain === "string" ? payload.shopDomain : undefined,
    };
  } catch {
    return null;
  }
}

export async function createOAuthPagesToken(payload: OAuthPagesPayload) {
  const id = `opp-${crypto.randomUUID()}`;
  await prisma.oAuthPagePick.create({
    data: {
      id,
      shopId: payload.shopId,
      channel: payload.channel,
      pagesJson: sealSecret(JSON.stringify(payload.pages)) ?? "",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return id;
}

export async function verifyOAuthPagesToken(token: string): Promise<OAuthPagesPayload | null> {
  if (!token.startsWith("opp-")) {
    return null;
  }

  try {
    const row = await prisma.oAuthPagePick.findUnique({ where: { id: token } });
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      if (row) {
        await prisma.oAuthPagePick.delete({ where: { id: token } }).catch(() => undefined);
      }
      return null;
    }

    const channel = row.channel;
    if (channel !== "facebook" && channel !== "instagram") {
      return null;
    }

    const rawJson = openSecret(row.pagesJson) ?? row.pagesJson;
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const pages: MetaPageOption[] = [];
    for (const item of parsed) {
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

    return { shopId: row.shopId, channel, pages };
  } catch {
    return null;
  }
}

export async function consumeOAuthPagesToken(token: string) {
  await prisma.oAuthPagePick.delete({ where: { id: token } }).catch(() => undefined);
}
