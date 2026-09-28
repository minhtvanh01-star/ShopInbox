import { ShopDirectory } from "@/components/admin/ShopDirectory";
import { ChannelSyncSettings } from "@/components/admin/ChannelSyncSettings";
import { requireSuperAdmin } from "@/backend/super-admin";
import { listPlatformShops } from "@/backend/platform-shops";
import { getChannelSyncSettings } from "@/backend/platform-channel-sync";
import { formatDateTimeVN } from "@/lib/labels";
import { DEFAULT_CHANNEL_SYNC_SETTINGS } from "@/lib/channel-sync";

export default async function AdminShopsPage() {
  await requireSuperAdmin();
  let shops: Awaited<ReturnType<typeof listPlatformShops>> = [];
  let loadError: string | null = null;
  let sync = DEFAULT_CHANNEL_SYNC_SETTINGS;
  try {
    shops = await listPlatformShops();
  } catch (error) {
    console.error("[AdminShopsPage] listPlatformShops", error);
    loadError = "Không tải được danh sách shop. Trên VPS chạy prisma migrate deploy rồi restart.";
  }
  try {
    sync = await getChannelSyncSettings();
  } catch (error) {
    console.error("[AdminShopsPage] getChannelSyncSettings", error);
    const syncError = "Không tải được cài quét kênh. Thử lại hoặc kiểm tra database.";
    loadError = loadError ? `${loadError} ${syncError}` : syncError;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <h1 className="page-title">Quản lý nền tảng</h1>
        <p className="page-subtitle">
          Super admin — cửa hàng trên nền tảng.
        </p>
      </header>
      {loadError ? (
        <p role="alert" className="alert-error mx-6 mt-4">
          {loadError}
        </p>
      ) : null}
      <div className="px-6 pt-6">
        <ChannelSyncSettings
          enabled={sync.enabled}
          intervalSec={sync.intervalSec}
          lastRunLabel={sync.lastRunAt ? formatDateTimeVN(sync.lastRunAt) : null}
        />
      </div>
      <ShopDirectory
        shops={shops.map((shop) => ({
          id: shop.id,
          name: shop.name,
          createdAt: formatDateTimeVN(shop.createdAt),
          setupDone: Boolean(shop.setupCompletedAt),
          suspended: Boolean(shop.suspendedAt),
          staffCount: shop.staffCount,
          seatLimit: shop.seatLimit,
          channelCount: shop.channelCount,
          orderCount: shop.orderCount,
          ownerName: shop.owner?.name ?? null,
          planCode: shop.planCode,
          supportStatus: shop.supportStatus,
        }))}
      />
    </div>
  );
}
