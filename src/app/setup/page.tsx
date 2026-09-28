import { AuthShell } from "@/components/auth/AuthShell";
import { SetupShopForm } from "@/components/setup/SetupShopForm";
import { logoutAction } from "@/app/login/actions";
import { requireSession } from "@/backend/auth";
import { prisma } from "@/backend/prisma";
import { hasPermission } from "@/backend/rbac";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";
import { getShopPolicy } from "@/backend/shop-policy";

export default async function SetupShopPage() {
  const session = await requireSession();
  const canSetup = await hasPermission(session, PERMISSION_CODES.settingsUpdate);
  const [shop, policy] = await Promise.all([
    prisma.shop.findUniqueOrThrow({
      where: { id: session.shopId },
      select: { name: true },
    }),
    getShopPolicy(session.shopId),
  ]);

  if (!canSetup) {
    return (
      <AuthShell
        title="Chờ cấu hình shop"
        subtitle="Cửa hàng chưa sẵn sàng"
        intro="Chủ shop đang đặt tên cửa hàng. Đăng nhập lại sau khi xong."
      >
        <form action={logoutAction} className="mt-6">
          <button type="submit" className="btn-primary w-full">
            Đăng xuất
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Cấu hình cửa hàng"
      subtitle="Bước 2 — đặt tên shop"
    >
      <SetupShopForm
        defaultName={shop.name}
        replyClaimTtlMinutes={policy.replyClaimTtlMinutes}
        maxUsersPerShop={policy.maxUsersPerShop}
      />
    </AuthShell>
  );
}
