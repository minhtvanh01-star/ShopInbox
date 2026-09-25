import { dispatchOutboundMessage } from "@/backend/channel-send";
import { prisma } from "@/backend/prisma";
import { isReplyClaimActive } from "@/backend/reply-claim";
import { getShopPolicy } from "@/backend/shop-policy";
import type { Prisma } from "@/generated/prisma/client";
import {
  parseAutoReplyRuleInput,
  pickAutoReplyMatch,
  AUTO_REPLY_MAX_PER_SHOP,
} from "@/lib/auto-reply";
import { replyClaimTtlMs } from "@/lib/shop-policy";
import type { Channel } from "@/lib/types";

export async function listAutoReplyRules(shopId: string) {
  return prisma.autoReplyRule.findMany({
    where: { shopId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createAutoReplyRule(
  shopId: string,
  raw: Parameters<typeof parseAutoReplyRuleInput>[0],
) {
  const parsed = parseAutoReplyRuleInput(raw);
  if (!parsed.ok) throw new Error(parsed.error);

  const count = await prisma.autoReplyRule.count({ where: { shopId } });
  if (count >= AUTO_REPLY_MAX_PER_SHOP) {
    throw new Error(`Mỗi shop tối đa ${AUTO_REPLY_MAX_PER_SHOP} rule auto-reply.`);
  }

  return prisma.autoReplyRule.create({
    data: {
      id: `ar-${crypto.randomUUID()}`,
      shopId,
      enabled: parsed.value.enabled,
      kind: parsed.value.kind,
      keywords: parsed.value.keywords,
      replyText: parsed.value.replyText,
      openMinute: parsed.value.openMinute,
      closeMinute: parsed.value.closeMinute,
      cooldownMinutes: parsed.value.cooldownMinutes,
      sortOrder: count,
    },
  });
}

export async function updateAutoReplyRule(
  shopId: string,
  id: string,
  raw: Parameters<typeof parseAutoReplyRuleInput>[0],
) {
  const parsed = parseAutoReplyRuleInput(raw);
  if (!parsed.ok) throw new Error(parsed.error);

  const existing = await prisma.autoReplyRule.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Không tìm thấy rule auto-reply.");

  return prisma.autoReplyRule.update({
    where: { id },
    data: {
      enabled: parsed.value.enabled,
      kind: parsed.value.kind,
      keywords: parsed.value.keywords,
      replyText: parsed.value.replyText,
      openMinute: parsed.value.openMinute,
      closeMinute: parsed.value.closeMinute,
      cooldownMinutes: parsed.value.cooldownMinutes,
    },
  });
}

export async function deleteAutoReplyRule(shopId: string, id: string) {
  const existing = await prisma.autoReplyRule.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Không tìm thấy rule auto-reply.");
  await prisma.autoReplyRule.delete({ where: { id } });
  return existing;
}

async function cooldownBlocksInTx(
  tx: Prisma.TransactionClient,
  conversationId: string,
  cooldownMinutes: number,
) {
  const since = new Date(Date.now() - cooldownMinutes * 60_000);
  const recent = await tx.message.findFirst({
    where: {
      conversationId,
      sender: "shop",
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(recent);
}

/**
 * Gửi auto-reply sau tin khách mới (không chạy khi sync lịch sử).
 * Lỗi gửi không làm fail ingest inbound.
 */
export async function tryAutoReplyAfterInbound(input: {
  shopId: string;
  conversationId: string;
  channel: Channel;
  customerId: string;
  customerText: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const rules = await listAutoReplyRules(input.shopId);
  if (rules.length === 0) {
    return { sent: false, reason: "no_rules" };
  }

  const match = pickAutoReplyMatch({
    customerText: input.customerText,
    rules: rules.map((rule) => ({
      kind: rule.kind,
      enabled: rule.enabled,
      keywords: rule.keywords,
      replyText: rule.replyText,
      openMinute: rule.openMinute,
      closeMinute: rule.closeMinute,
      sortOrder: rule.sortOrder,
      cooldownMinutes: rule.cooldownMinutes,
    })),
  });

  if (!match) {
    return { sent: false, reason: "no_match" };
  }

  const policy = await getShopPolicy(input.shopId);
  const ttlMs = replyClaimTtlMs(policy.replyClaimTtlMinutes);
  const createdAt = new Date();

  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM conversations WHERE id = ${input.conversationId} FOR UPDATE`;

    const conversation = await tx.conversation.findUnique({
      where: { id: input.conversationId },
      select: { id: true, staffId: true, replyClaimedAt: true },
    });
    if (!conversation || conversation.id !== input.conversationId) {
      return { ok: false as const, reason: "missing_conversation" as const };
    }

    if (conversation.staffId && isReplyClaimActive(conversation.replyClaimedAt, undefined, ttlMs)) {
      return { ok: false as const, reason: "claimed" as const };
    }

    if (await cooldownBlocksInTx(tx, input.conversationId, match.cooldownMinutes)) {
      return { ok: false as const, reason: "cooldown" as const };
    }

    const message = await tx.message.create({
      data: {
        shopId: input.shopId,
        conversationId: input.conversationId,
        staffId: null,
        sender: "shop",
        text: match.replyText,
        createdAt,
      },
    });
    await tx.conversation.update({
      where: { id: input.conversationId },
      data: {
        lastMessage: match.replyText,
        lastAt: createdAt,
      },
    });
    return { ok: true as const, messageId: message.id };
  });

  if (!reserved.ok) {
    return { sent: false, reason: reserved.reason };
  }

  try {
    const outbound = await dispatchOutboundMessage({
      shopId: input.shopId,
      channel: input.channel,
      customerId: input.customerId,
      text: match.replyText,
    });
    if (outbound.mode === "remote") {
      await prisma.message.update({
        where: { id: reserved.messageId },
        data: { externalMessageId: outbound.externalMessageId },
      });
    }
    return { sent: true };
  } catch (error) {
    await prisma.message.delete({ where: { id: reserved.messageId } }).catch(() => undefined);
    console.error("[tryAutoReplyAfterInbound] send failed", error);
    return { sent: false, reason: "send_failed" };
  }
}
