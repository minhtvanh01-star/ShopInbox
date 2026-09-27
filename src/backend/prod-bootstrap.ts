import { createOpenRegistrationStaff } from "@/backend/open-registration";
import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { syncRbacCatalog } from "@/backend/rbac-sync";
import { readFirstAdminBootstrap } from "@/lib/first-run";
import { pickFirstSuperAdminStaffId } from "@/lib/super-admin";

let bootstrapPromise: Promise<void> | null = null;

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
    await ensureFirstAdminAccount();
    await grantFirstSuperAdmin();
  } catch (error) {
    console.error("[ensureProductionData] Super admin grant failed", error);
  }
}

/** DB trống + SUPER_ADMIN_EMAIL/PASSWORD — tạo Super admin để vào hệ thống. */
export async function ensureFirstAdminAccount() {
  const spec = readFirstAdminBootstrap(process.env);
  if (!spec) return;

  let staffCount = 0;
  try {
    staffCount = await prisma.staff.count();
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    console.error("[ensureFirstAdminAccount] staff count failed — skip", error);
    return;
  }
  if (staffCount > 0) return;

  const created = await createOpenRegistrationStaff({
    email: spec.email,
    name: spec.name,
    passwordHash: await hashPassword(spec.password),
  });
  if (!created.ok) {
    console.error("[ensureFirstAdminAccount] create failed", created.error);
    return;
  }

  try {
    await prisma.shop.update({
      where: { id: created.staff.shopId },
      data: { setupCompletedAt: new Date() },
    });
  } catch (error) {
    console.error("[ensureFirstAdminAccount] shop setup stamp failed", error);
  }
  await grantFirstSuperAdmin();
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
    data: { isSuperAdmin: true, sessionVersion: { increment: 1 } },
  });
}
