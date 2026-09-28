import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/backend/prisma";
import { OPEN_REGISTRATION_LOCK_KEY } from "@/backend/open-registration";
import { abandonIncompleteShopReason } from "@/lib/abandon-shop-registration";
import type { SessionPayload } from "@/backend/session-token";

export type AbandonShopRegistrationResult =
  | { ok: true; shopId: string }
  | { ok: false; error: string };

async function withOpenRegistrationLock<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${OPEN_REGISTRATION_LOCK_KEY})`;
    return fn(tx);
  });
}

/** Xóa shop đăng ký dở (Google / email) khi chưa xong /setup. */
export async function abandonIncompleteShopRegistration(
  session: SessionPayload,
): Promise<AbandonShopRegistrationResult> {
  try {
    return await withOpenRegistrationLock(async (tx) => {
      const shop = await tx.shop.findUnique({
        where: { id: session.shopId },
        select: {
          id: true,
          setupCompletedAt: true,
          staff: { select: { id: true } },
          _count: { select: { channelAccounts: true } },
        },
      });
      if (!shop) {
        return { ok: false, error: "Không tìm thấy cửa hàng." };
      }

      const blocked = abandonIncompleteShopReason({
        isSuperAdmin: Boolean(session.isSuperAdmin),
        role: session.role,
        setupCompletedAt: shop.setupCompletedAt,
        actorStaffId: session.staffId,
        staffIds: shop.staff.map((row) => row.id),
        channelCount: shop._count.channelAccounts,
      });
      if (blocked) {
        return { ok: false, error: blocked };
      }

      await tx.shopInvite.deleteMany({ where: { shopId: shop.id } });
      await tx.shop.delete({ where: { id: shop.id } });
      return { ok: true, shopId: shop.id };
    });
  } catch (error) {
    console.error("[abandonIncompleteShopRegistration] failed", error);
    return { ok: false, error: "Không hủy đăng ký được. Thử lại." };
  }
}
