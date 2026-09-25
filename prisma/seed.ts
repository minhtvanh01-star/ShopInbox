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
import { resolveSeedMode, resolveSeedScope } from "../src/backend/db-seed-policy";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  normalizeRoleCode,
} from "../src/lib/rbac-catalog";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Thiếu DATABASE_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function syncRbacCatalog() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        sortOrder: role.sortOrder,
      },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        sortOrder: role.sortOrder,
      },
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
        group: permission.group,
      },
      update: {
        name: permission.name,
        description: permission.description,
        group: permission.group,
      },
    });
  }

  await prisma.rolePermission.deleteMany();
  await prisma.rolePermission.createMany({
    data: Object.entries(ROLE_PERMISSIONS).flatMap(([roleCode, codes]) =>
      codes.map((permissionCode) => ({ roleCode, permissionCode })),
    ),
  });
}

async function lockDemoAccounts() {
  await prisma.shop.upsert({
    where: { id: SHOP.id },
    create: { id: SHOP.id, name: SHOP.name },
    update: { name: SHOP.name },
  });

  const adminHash = await hash(SHOP.staffPassword, 12);
  await prisma.staff.upsert({
    where: { email: SHOP.staffEmail },
    create: {
      id: SHOP.staffId,
      shopId: SHOP.id,
      name: SHOP.staffName,
      email: SHOP.staffEmail,
      passwordHash: adminHash,
      roleCode: normalizeRoleCode(SHOP.role),
      isActive: true,
    },
    update: {
      name: SHOP.staffName,
      shopId: SHOP.id,
      passwordHash: adminHash,
      roleCode: normalizeRoleCode(SHOP.role),
      isActive: true,
    },
  });

  for (const member of EXTRA_STAFF) {
    const passwordHash = await hash(member.password, 12);
    await prisma.staff.upsert({
      where: { email: member.email },
      create: {
        id: member.id,
        shopId: SHOP.id,
        name: member.name,
        email: member.email,
        passwordHash,
        roleCode: normalizeRoleCode(member.role),
        isActive: true,
      },
      update: {
        name: member.name,
        shopId: SHOP.id,
        passwordHash,
        roleCode: normalizeRoleCode(member.role),
        isActive: true,
      },
    });
  }

  console.log("Đã khóa tài khoản demo vào DB (không xóa dữ liệu khác):");
  console.log(`  Admin   ${SHOP.staffEmail} / ${SHOP.staffPassword}`);
  console.log(`  Nhân viên ${EXTRA_STAFF[0]?.email} / ${EXTRA_STAFF[0]?.password}`);
}

async function main() {
  const shopCount = await prisma.shop.count();
  const mode = resolveSeedMode(process.env, shopCount);
  const scope = resolveSeedScope(process.env, process.argv);
  const lockAccounts = process.argv.includes("--lock") || process.env.SEED_LOCK === "1";

  await syncRbacCatalog();

  if (lockAccounts) {
    await lockDemoAccounts();
    return;
  }

  if (mode === "skip") {
    console.log("Seed: DB đã có dữ liệu, bỏ qua demo (chỉ đồng bộ RBAC).");
    return;
  }

  if (mode === "replace") {
    await prisma.auditLog.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.orderChecklistCheck.deleteMany();
    await prisma.order.deleteMany();
    await prisma.orderChecklistTemplate.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.customerIdentity.deleteMany();
    await prisma.quickReply.deleteMany();
    await prisma.product.deleteMany();
    await prisma.productGroup.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.channelAccount.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.shop.deleteMany();
  }

  console.log(
    scope === "staff"
      ? "Seed: chỉ shop + 2 nhân viên."
      : mode === "insert"
        ? "Seed: DB trống, ghi dữ liệu demo."
        : "Seed: ghi đè dữ liệu demo.",
  );

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
      roleCode: normalizeRoleCode(SHOP.role),
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
        roleCode: normalizeRoleCode(member.role),
      },
    });
  }

  if (scope === "staff") {
    return;
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

  for (const product of products) {
    await prisma.product.create({
      data: {
        id: product.id,
        shopId: SHOP.id,
        code: product.code,
        name: product.name,
        vatPolicy: product.vatPolicy,
        taxRate: product.taxRate ?? null,
        selling: product.selling,
        variants: {
          create: product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku ?? null,
            name: variant.name,
            price: variant.price,
            costPrice: variant.costPrice,
            selling: variant.selling,
            sortOrder: variant.sortOrder,
          })),
        },
      },
    });
  }

  const { DEFAULT_ORDER_CHECKLIST_LABELS } = await import("@/lib/order-checklist");
  await prisma.orderChecklistTemplate.createMany({
    data: DEFAULT_ORDER_CHECKLIST_LABELS.map((label, index) => ({
      id: `oct-seed-${index + 1}`,
      shopId: SHOP.id,
      label,
      sortOrder: index,
      enabled: true,
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
      staffId: null,
      replyClaimedAt: null,
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
            variantId: item.productId ? `pv-${item.productId}` : null,
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
