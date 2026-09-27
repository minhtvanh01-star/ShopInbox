import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { syncRbacCatalog } from "@/backend/rbac-sync";
import { readFirstAdminBootstrap } from "@/lib/first-run";
import {
  PLATFORM_SHOP_ID,
  PLATFORM_SHOP_NAME,
  parseSuperAdminEmails,
  pickFirstSuperAdminStaffId,
} from "@/lib/super-admin";
import { normalizeRoleCode, BOOTSTRAP_ROLE_CODE } from "@/lib/rbac-catalog";

let bootstrapPromise: Promise<void> | null = null;
let readyPromise: Promise<void> | null = null;

/** Migrate + RBAC + Super admin — chạy lúc boot, không cần terminal VPS. */
export async function ensureDatabaseReady() {
  if (!readyPromise) {
    readyPromise = runDatabaseReady().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

async function runDatabaseReady() {
  const { deployPendingMigrations } = await import("@/backend/migrate-deploy");
  await deployPendingMigrations();
  await ensureProductionData();
}

/** RBAC + Super admin lần đầu. Không seed hội thoại / mật khẩu demo. */
export async function ensureProductionData() {
  if (!bootstrapPromise) {
    bootstrapPromise = runProductionBootstrap().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}

async function runProductionBootstrap() {
  try {
    await syncRbacCatalog(prisma);
  } catch (error) {
    console.error("[ensureProductionData] RBAC sync failed", error);
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
  }

  try {
    await ensurePlatformShop();
    await ensureFirstAdminAccount();
    await grantFirstSuperAdmin();
    await parkSuperAdminsOnPlatformShop();
  } catch (error) {
    console.error("[ensureProductionData] Super admin grant failed", error);
  }
}

async function ensurePlatformShop() {
  await prisma.shop.upsert({
    where: { id: PLATFORM_SHOP_ID },
    create: {
      id: PLATFORM_SHOP_ID,
      name: PLATFORM_SHOP_NAME,
      setupCompletedAt: new Date(),
    },
    update: { name: PLATFORM_SHOP_NAME, setupCompletedAt: new Date() },
  });
}

/** Super admin chỉ ở shop nền tảng. Có SUPER_ADMIN_EMAIL thì gỡ flag khỏi chủ shop khách. */
async function parkSuperAdminsOnPlatformShop() {
  await ensurePlatformShop();
  const allowlist = parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAIL);
  if (allowlist.length > 0) {
    await prisma.staff.updateMany({
      where: { isSuperAdmin: true, email: { notIn: allowlist } },
      data: { isSuperAdmin: false, sessionVersion: { increment: 1 } },
    });
  }
  await prisma.staff.updateMany({
    where: { isSuperAdmin: true, shopId: { not: PLATFORM_SHOP_ID } },
    data: { shopId: PLATFORM_SHOP_ID, sessionVersion: { increment: 1 } },
  });
}

/** SUPER_ADMIN_EMAIL/PASSWORD — tạo hoặc chuyển Super admin sang shop nền tảng. */
export async function ensureFirstAdminAccount() {
  const spec = readFirstAdminBootstrap(process.env);
  if (!spec) return;

  try {
    await ensurePlatformShop();
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    console.error("[ensureFirstAdminAccount] platform shop failed — skip", error);
    return;
  }

  const existing = await prisma.staff.findUnique({
    where: { email: spec.email },
    select: { id: true, shopId: true, isSuperAdmin: true },
  });
  if (existing) {
    if (existing.shopId !== PLATFORM_SHOP_ID || !existing.isSuperAdmin) {
      await prisma.staff.update({
        where: { id: existing.id },
        data: {
          shopId: PLATFORM_SHOP_ID,
          isSuperAdmin: true,
          sessionVersion: { increment: 1 },
        },
      });
    }
    return;
  }

  await prisma.staff.create({
    data: {
      id: `staff-${crypto.randomUUID()}`,
      shopId: PLATFORM_SHOP_ID,
      name: spec.name,
      email: spec.email,
      passwordHash: await hashPassword(spec.password),
      roleCode: normalizeRoleCode(BOOTSTRAP_ROLE_CODE),
      isActive: true,
      isSuperAdmin: true,
    },
  });
}

export async function ensureFirstSuperAdminGranted() {
  return grantFirstSuperAdmin();
}

async function grantFirstSuperAdmin() {
  let existingSuperAdminCount = 0;
  try {
    existingSuperAdminCount = await prisma.staff.count({ where: { isSuperAdmin: true } });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    console.error("[ensureProductionData] isSuperAdmin column missing — skip grant", error);
    return;
  }

  const staff = await prisma.staff.findMany({
    where: { isActive: true },
    select: { id: true, email: true, roleCode: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const staffId = pickFirstSuperAdminStaffId({
    existingSuperAdminCount,
    allowlist: process.env.SUPER_ADMIN_EMAIL,
    staff,
  });
  if (!staffId) return;

  await prisma.staff.update({
    where: { id: staffId },
    data: {
      isSuperAdmin: true,
      shopId: PLATFORM_SHOP_ID,
      sessionVersion: { increment: 1 },
    },
  });
}
