import { ShopDirectory } from "@/components/admin/ShopDirectory";
import { requireSuperAdmin } from "@/backend/super-admin";
import { listPlatformShops } from "@/backend/platform-shops";
import { formatDateTimeVN } from "@/lib/labels";

export default async function AdminShopsPage() {
  await requireSuperAdmin();
  let shops: Awaited<ReturnType<typeof listPlatformShops>> = [];
  let loadError: string | null = null;
  try {
    shops = await listPlatformShops();
  } catch (error) {
    console.error("[AdminShopsPage] listPlatformShops", error);
    loadError = "Không tải được danh sách shop. Trên VPS chạy prisma migrate deploy rồi restart.";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <h1 className="page-title">Quản lý nền tảng</h1>
        <p className="page-subtitle">
          Super admin — cửa hàng, người dùng, gói và nhu cầu hỗ trợ. Không vào hội thoại khách.
        </p>
      </header>
      {loadError ? (
        <p role="alert" className="alert-error mx-6 mt-4">
          {loadError}
        </p>
      ) : null}
      <ShopDirectory
        shops={shops.map((shop) => ({
          id: shop.id,
          name: shop.name,
          createdAt: formatDateTimeVN(shop.createdAt),
          setupDone: Boolean(shop.setupCompletedAt),
          suspended: Boolean(shop.suspendedAt),
          staffCount: shop.staffCount,
          channelCount: shop.channelCount,
          orderCount: shop.orderCount,
          ownerName: shop.owner?.name ?? null,
          ownerEmail: shop.owner?.email ?? null,
          planCode: shop.planCode,
          supportStatus: shop.supportStatus,
        }))}
      />
    </div>
  );
}
