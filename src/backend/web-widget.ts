import { ingestInboundMessage } from "@/backend/message-sync";
import { getPublicAppUrl } from "@/backend/oauth-config";
import { prisma } from "@/backend/prisma";
import { consumeWebWidgetRequestLimit } from "@/backend/web-widget-rate";
import { isLoopbackHost } from "@/lib/security-headers";
import {
  canonicalWebsitePageId,
  createWebWidgetKey,
  normalizeWebsiteHost,
  parseWebWidgetInbound,
  websiteOriginAllowed,
} from "@/lib/web-widget";

export async function findReadyWebChannelByKey(key: string) {
  const secret = key.trim();
  if (!secret) return null;
  return prisma.channelAccount.findFirst({
    where: {
      channel: "web",
      status: "ready",
      webhookSecret: secret,
      shop: { suspendedAt: null },
    },
    select: {
      id: true,
      shopId: true,
      pageId: true,
      webhookSecret: true,
    },
  });
}

export function webWidgetCorsAllowed(
  origin: string | null | undefined,
  configuredDomain: string | null | undefined,
  extraOrigins: Array<string | null | undefined> = [getPublicAppUrl()],
) {
  if (websiteOriginAllowed(origin, configuredDomain)) return true;
  if (extraOrigins.some((extra) => websiteOriginAllowed(origin, extra))) return true;
  const host = normalizeWebsiteHost(origin);
  return Boolean(host && isLoopbackHost(host));
}

/** Preflight: origin app, localhost, hoặc host đã lưu trên một kênh web ready. */
export async function isKnownWebWidgetOrigin(origin: string | null | undefined) {
  if (webWidgetCorsAllowed(origin, null)) return true;
  const pageId = canonicalWebsitePageId(origin);
  if (!pageId) return false;
  const match = await prisma.channelAccount.findFirst({
    where: {
      channel: "web",
      status: "ready",
      pageId,
      shop: { suspendedAt: null },
    },
    select: { id: true },
  });
  return Boolean(match);
}

export async function ingestWebWidgetMessage(input: {
  key: string;
  origin: string | null;
  ip?: string;
  visitorId?: unknown;
  text?: unknown;
  name?: unknown;
  externalMessageId?: unknown;
}) {
  const account = await findReadyWebChannelByKey(input.key);
  if (!account) {
    return { ok: false as const, error: "unauthorized" as const, status: 401 };
  }
  if (!webWidgetCorsAllowed(input.origin, account.pageId)) {
    return { ok: false as const, error: "origin" as const, status: 403 };
  }

  const parsed = parseWebWidgetInbound({
    visitorId: input.visitorId,
    text: input.text,
    name: input.name,
    externalMessageId: input.externalMessageId,
  });
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error, status: 400 };
  }

  if (
    !consumeWebWidgetRequestLimit({
      action: "post",
      key: input.key,
      ip: input.ip,
      visitorId: parsed.visitorId,
    })
  ) {
    return { ok: false as const, error: "rate_limited" as const, status: 429 };
  }

  const ingested = await ingestInboundMessage({
    channel: "web",
    externalAccountId: account.pageId ?? account.webhookSecret ?? account.id,
    senderExternalId: parsed.visitorId,
    senderName: parsed.name,
    text: parsed.text,
    externalMessageId: parsed.externalMessageId,
  });

  if (!ingested.ok) {
    return { ok: false as const, error: ingested.reason, status: 409 };
  }

  return {
    ok: true as const,
    conversationId: ingested.conversationId,
    duplicate: ingested.duplicate,
  };
}

export async function listWebWidgetShopReplies(input: {
  key: string;
  origin: string | null;
  ip?: string;
  visitorId: string;
  after?: string | null;
}) {
  const account = await findReadyWebChannelByKey(input.key);
  if (!account) {
    return { ok: false as const, error: "unauthorized" as const, status: 401 };
  }
  if (!webWidgetCorsAllowed(input.origin, account.pageId)) {
    return { ok: false as const, error: "origin" as const, status: 403 };
  }

  if (
    !consumeWebWidgetRequestLimit({
      action: "poll",
      key: input.key,
      ip: input.ip,
      visitorId: input.visitorId,
    })
  ) {
    return { ok: false as const, error: "rate_limited" as const, status: 429 };
  }

  const identity = await prisma.customerIdentity.findFirst({
    where: {
      channel: "web",
      externalId: input.visitorId,
      customer: { shopId: account.shopId },
    },
    select: { customerId: true },
  });
  if (!identity) {
    return { ok: true as const, messages: [] as Array<{ id: string; text: string; createdAt: string }> };
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      shopId: account.shopId,
      customerId: identity.customerId,
      channel: "web",
    },
    select: { id: true },
  });
  if (!conversation) {
    return { ok: true as const, messages: [] };
  }

  const afterMs = input.after ? Date.parse(input.after) : NaN;
  const after = Number.isFinite(afterMs) ? new Date(afterMs) : new Date(0);

  const rows = await prisma.message.findMany({
    where: {
      shopId: account.shopId,
      conversationId: conversation.id,
      sender: "shop",
      createdAt: { gt: after },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, text: true, createdAt: true },
  });

  return {
    ok: true as const,
    messages: rows.map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function rotateWebWidgetKey(shopId: string) {
  const account = await prisma.channelAccount.findUnique({
    where: { shopId_channel: { shopId, channel: "web" } },
    select: { id: true, status: true },
  });
  if (!account || account.status !== "ready") {
    return { ok: false as const, error: "Kênh web chưa sẵn sàng để đổi widget key." };
  }

  const key = createWebWidgetKey();
  await prisma.channelAccount.update({
    where: { id: account.id },
    data: { webhookSecret: key },
  });
  return { ok: true as const, key };
}
