"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function sendMessage(conversationId: string, text: string) {
  const session = await requireSession();
  const body = text.trim();
  if (!conversationId || !body) {
    throw new Error("Tin nhắn không hợp lệ");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  const createdAt = new Date();
  const message = await prisma.message.create({
    data: {
      shopId: session.shopId,
      conversationId,
      staffId: session.staffId,
      sender: "shop",
      text: body,
      createdAt,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: body,
      lastAt: createdAt,
      unread: 0,
    },
  });

  revalidatePath("/inbox");

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
  };
}
