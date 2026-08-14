import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  EXTRA_STAFF,
  SHOP,
  channelAccounts,
  conversations,
  customers,
  messages,
  orders,
  products,
  quickReplies,
} from "../src/lib/mock";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Thiếu DATABASE_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.customerIdentity.deleteMany();
  await prisma.quickReply.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.channelAccount.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.shop.deleteMany();

  await prisma.shop.create({
    data: {
      id: SHOP.id,
      name: SHOP.name,
    },
  });

  await prisma.staff.create({
    data: {
      id: SHOP.staffId,
      shopId: SHOP.id,
      name: SHOP.staffName,
      email: SHOP.staffEmail,
      passwordHash: await hash(SHOP.staffPassword, 12),
      role: SHOP.role,
    },
  });

  for (const member of EXTRA_STAFF) {
    await prisma.staff.create({
      data: {
        id: member.id,
        shopId: SHOP.id,
        name: member.name,
        email: member.email,
        passwordHash: await hash(member.password, 12),
        role: member.role,
      },
    });
  }
  await prisma.channelAccount.createMany({
    data: channelAccounts.map((account) => ({
      id: account.id,
      shopId: SHOP.id,
      channel: account.channel,
      name: account.name,
      status: account.status,
      note: account.note,
    })),
  });

  await prisma.product.createMany({
    data: products.map((product) => ({
      id: product.id,
      shopId: SHOP.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      inStock: product.inStock,
    })),
  });

  await prisma.customer.createMany({
    data: customers.map((customer) => ({
      id: customer.id,
      shopId: SHOP.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      note: customer.note,
    })),
  });

  await prisma.customerIdentity.createMany({
    data: conversations.map((conversation) => ({
      id: `id-${conversation.customerId}-${conversation.channel}`,
      customerId: conversation.customerId,
      channel: conversation.channel,
      externalId: `${conversation.channel}:${conversation.customerId}`,
    })),
  });

  await prisma.conversation.createMany({
    data: conversations.map((conversation) => ({
      id: conversation.id,
      shopId: SHOP.id,
      customerId: conversation.customerId,
      staffId: SHOP.staffId,
      channel: conversation.channel,
      lastMessage: conversation.lastMessage,
      lastAt: new Date(conversation.lastAt),
      unread: conversation.unread,
      tag: conversation.tag,
    })),
  });

  await prisma.message.createMany({
    data: messages.map((message) => ({
      id: message.id,
      shopId: SHOP.id,
      conversationId: message.conversationId,
      staffId: message.sender === "shop" ? SHOP.staffId : null,
      sender: message.sender,
      text: message.text,
      createdAt: new Date(message.createdAt),
    })),
  });

  for (const order of orders) {
    await prisma.order.create({
      data: {
        id: order.id,
        shopId: SHOP.id,
        customerId: order.customerId,
        conversationId: order.conversationId,
        code: order.code,
        address: order.address,
        status: order.status,
        createdAt: new Date(order.createdAt),
        items: {
          create: order.items.map((item, index) => ({
            id: `${order.id}-i${index + 1}`,
            productId: item.productId,
            name: item.name,
            qty: item.qty,
            price: item.price,
          })),
        },
      },
    });
  }

  await prisma.quickReply.createMany({
    data: quickReplies.map((reply) => ({
      id: reply.id,
      shopId: SHOP.id,
      title: reply.title,
      text: reply.text,
    })),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
