import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { isHosted } from "../src/backend/db-seed-policy";
import { prismaPgConfig } from "../src/lib/database-url";
import { PLATFORM_SUPER_ADMIN } from "../src/lib/mock";

const prisma = new PrismaClient({
  adapter: new PrismaPg(prismaPgConfig(process.env.DATABASE_URL)),
});

function parseEmailArg(argv: string[]) {
  return argv
    .slice(2)
    .map((part) => part.trim().toLowerCase())
    .find((part) => part && !part.startsWith("--"));
}

async function upsertDemoSuperAdmin() {
  if (isHosted(process.env) && process.env.SEED_FORCE !== "1") {
    throw new Error(
      "Không tạo tài khoản demo Super admin trên production. Gán email đã đăng nhập: npx tsx prisma/grant-super-admin.ts ban@email.com",
    );
  }
  const admin = PLATFORM_SUPER_ADMIN;
  await prisma.shop.upsert({
    where: { id: admin.shopId },
    create: { id: admin.shopId, name: admin.shopName, setupCompletedAt: new Date() },
    update: { name: admin.shopName, setupCompletedAt: new Date() },
  });
  const passwordHash = await hash(admin.password, 12);
  await prisma.staff.upsert({
    where: { email: admin.email },
    create: {
      id: admin.staffId,
      shopId: admin.shopId,
      name: admin.name,
      email: admin.email,
      passwordHash,
      roleCode: "admin",
      isActive: true,
      isSuperAdmin: true,
    },
    update: {
      name: admin.name,
      shopId: admin.shopId,
      isActive: true,
      isSuperAdmin: true,
    },
  });
  console.log(`Đã tạo Super admin demo ${admin.email} / ${admin.password}`);
  console.log("Đăng xuất rồi đăng nhập lại — vào /admin/shops, không vào Inbox.");
}

async function grantExisting(email: string) {
  const staff = await prisma.staff.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isSuperAdmin: true, shop: { select: { name: true } } },
  });
  if (!staff) {
    throw new Error(
      `Không có tài khoản ${email}. Đăng ký hoặc đăng nhập email đó trước, rồi chạy lại lệnh này.`,
    );
  }
  if (staff.isSuperAdmin) {
    console.log(`${email} đã là Super admin (${staff.shop.name}). Đăng xuất rồi đăng nhập lại.`);
    return;
  }
  await prisma.staff.update({
    where: { id: staff.id },
    data: { isSuperAdmin: true, sessionVersion: { increment: 1 } },
  });
  console.log(`Đã gán Super admin cho ${staff.name} <${email}> (shop ${staff.shop.name}).`);
  console.log("Đăng xuất rồi đăng nhập lại — vào Quản lý nền tảng, không còn Inbox shop.");
}

async function main() {
  const demo = process.argv.includes("--demo");
  const email = parseEmailArg(process.argv) || process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (demo) {
    await upsertDemoSuperAdmin();
    return;
  }
  if (!email) {
    throw new Error(
      "Truyền email đã đăng nhập: npx tsx prisma/grant-super-admin.ts ban@email.com",
    );
  }
  await grantExisting(email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
