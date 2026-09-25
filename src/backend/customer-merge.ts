import { prisma } from "@/backend/prisma";
import type { Channel } from "@/lib/types";

function identityKey(externalId: string | null | undefined) {
  return externalId?.trim() || "";
}

/**
 * Gộp khách absorb vào keep (cùng shop).
 * Cùng kênh + PSID/UID khác nhau → từ chối (tránh gửi nhầm người).
 * Cùng kênh: giữ identity đang có externalId; hội thoại trùng kênh được gộp thread.
 */
export async function mergeCustomers(shopId: string, keepId: string, absorbId: string) {
  if (keepId === absorbId) {
    throw new Error("Chọn hai khách khác nhau.");
  }

  const [keep, absorb] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: keepId, shopId },
      include: { identities: true },
    }),
    prisma.customer.findFirst({
      where: { id: absorbId, shopId },
      include: { identities: true },
    }),
  ]);

  if (!keep || !absorb) {
    throw new Error("Không tìm thấy khách để gộp.");
  }

  for (const absorbIdentity of absorb.identities) {
    const keepIdentity = keep.identities.find((item) => item.channel === absorbIdentity.channel);
    if (!keepIdentity) continue;
    const keepExt = identityKey(keepIdentity.externalId);
    const absorbExt = identityKey(absorbIdentity.externalId);
    if (keepExt && absorbExt && keepExt !== absorbExt) {
      throw new Error(
        `Không gộp được: cả hai khách đều có kênh ${absorbIdentity.channel} với ID khác nhau. Gộp sẽ gửi nhầm người.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const identity of absorb.identities) {
      const keepIdentity = keep.identities.find((item) => item.channel === identity.channel);
      if (!keepIdentity) {
        await tx.customerIdentity.update({
          where: { id: identity.id },
          data: { customerId: keep.id },
        });
        continue;
      }

      const keepExt = identityKey(keepIdentity.externalId);
      const absorbExt = identityKey(identity.externalId);
      if (!keepExt && absorbExt) {
        await tx.customerIdentity.delete({ where: { id: keepIdentity.id } });
        await tx.customerIdentity.update({
          where: { id: identity.id },
          data: { customerId: keep.id },
        });
      } else {
        await tx.customerIdentity.delete({ where: { id: identity.id } });
      }
    }

    const absorbConversations = await tx.conversation.findMany({
      where: { customerId: absorb.id, shopId },
    });
    const keepConversations = await tx.conversation.findMany({
      where: { customerId: keep.id, shopId },
    });

    for (const absorbConv of absorbConversations) {
      const keepConv = keepConversations.find((item) => item.channel === absorbConv.channel);
      if (!keepConv) {
        await tx.conversation.update({
          where: { id: absorbConv.id },
          data: { customerId: keep.id },
        });
        continue;
      }

      await tx.message.updateMany({
        where: { conversationId: absorbConv.id },
        data: { conversationId: keepConv.id },
      });
      await tx.order.updateMany({
        where: { conversationId: absorbConv.id, shopId },
        data: { conversationId: keepConv.id },
      });
      const lastAt = absorbConv.lastAt > keepConv.lastAt ? absorbConv.lastAt : keepConv.lastAt;
      const lastMessage =
        absorbConv.lastAt > keepConv.lastAt ? absorbConv.lastMessage : keepConv.lastMessage;
      await tx.conversation.update({
        where: { id: keepConv.id },
        data: {
          lastAt,
          lastMessage,
          unread: keepConv.unread + absorbConv.unread,
        },
      });
      await tx.conversation.delete({ where: { id: absorbConv.id } });
    }

    await tx.order.updateMany({
      where: { customerId: absorb.id, shopId },
      data: { customerId: keep.id },
    });

    await tx.customer.update({
      where: { id: keep.id },
      data: {
        phone: keep.phone || absorb.phone,
        email: keep.email || absorb.email,
        address: keep.address || absorb.address,
        note: [keep.note, absorb.note].filter(Boolean).join(" | ") || keep.note,
        avatarUrl: keep.avatarUrl || absorb.avatarUrl,
        name: keep.name.trim() || absorb.name,
      },
    });

    await tx.customer.delete({ where: { id: absorb.id } });
  });

  return { keepId: keep.id, absorbId: absorb.id, keepName: keep.name };
}

export type { Channel };
