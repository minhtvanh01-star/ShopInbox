import { prisma } from "@/backend/prisma";
import {
  parseQuickReplyInput,
  QUICK_REPLY_MAX_PER_SHOP,
  type QuickReplyInput,
} from "@/lib/quick-reply";

export async function listQuickReplies(shopId: string) {
  return prisma.quickReply.findMany({
    where: { shopId },
    orderBy: { title: "asc" },
  });
}

export async function createQuickReply(shopId: string, raw: { title?: string; text?: string }) {
  const parsed = parseQuickReplyInput(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const count = await prisma.quickReply.count({ where: { shopId } });
  if (count >= QUICK_REPLY_MAX_PER_SHOP) {
    throw new Error(`Mỗi shop tối đa ${QUICK_REPLY_MAX_PER_SHOP} mẫu tin.`);
  }

  return prisma.quickReply.create({
    data: {
      id: `qr-${crypto.randomUUID()}`,
      shopId,
      title: parsed.value.title,
      text: parsed.value.text,
    },
  });
}

export async function updateQuickReply(
  shopId: string,
  id: string,
  raw: { title?: string; text?: string },
) {
  const parsed = parseQuickReplyInput(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const existing = await prisma.quickReply.findFirst({ where: { id, shopId } });
  if (!existing) {
    throw new Error("Không tìm thấy mẫu tin.");
  }

  return prisma.quickReply.update({
    where: { id },
    data: {
      title: parsed.value.title,
      text: parsed.value.text,
    },
  });
}

export async function deleteQuickReply(shopId: string, id: string) {
  const existing = await prisma.quickReply.findFirst({ where: { id, shopId } });
  if (!existing) {
    throw new Error("Không tìm thấy mẫu tin.");
  }

  await prisma.quickReply.delete({ where: { id } });
  return existing;
}

export type { QuickReplyInput };
