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
        intro="Chủ shop đang hoàn tất tên cửa hàng và cấu hình vận hành. Bạn đăng nhập lại sau khi bước đó xong."
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
      subtitle="Bước 1 — đặt tên shop"
      intro={
        <>
          Đây là cửa hàng của bạn, tách biệt với shop khác trên hệ thống. Đặt tên và giới hạn nhân
          viên trước. Bước tiếp theo: kết nối Facebook / Instagram / Zalo, rồi mời nhân viên.
        </>
      }
    >
      <SetupShopForm
        defaultName={shop.name}
        replyClaimTtlMinutes={policy.replyClaimTtlMinutes}
        maxUsersPerShop={policy.maxUsersPerShop}
      />
    </AuthShell>
  );
}
