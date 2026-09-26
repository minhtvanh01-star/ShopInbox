import { notFound } from "next/navigation";
import { ShopDetailPanel } from "@/components/admin/ShopDetailPanel";
import { requireSuperAdmin } from "@/backend/super-admin";
import { getPlatformShopDetail } from "@/backend/platform-shops";
import { CHANNEL_LABEL, CHANNEL_STATUS_LABEL, formatDateTimeVN } from "@/lib/labels";
import { planExpiryInputValue } from "@/lib/shop-ops";

type ShopDetailPageProps = {
  params: Promise<{ shopId: string }>;
};

export default async function AdminShopDetailPage({ params }: ShopDetailPageProps) {
  await requireSuperAdmin();
  const { shopId } = await params;
  const shop = await getPlatformShopDetail(shopId);
  if (!shop) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <h1 className="page-title">{shop.name}</h1>
        <p className="page-subtitle">Người dùng, gói và hỗ trợ · không vào hội thoại</p>
      </header>
      <ShopDetailPanel
        shopId={shop.id}
        name={shop.name}
        suspended={Boolean(shop.suspendedAt)}
        setupDone={Boolean(shop.setupCompletedAt)}
        createdAt={formatDateTimeVN(shop.createdAt)}
        counts={{
          staff: shop.staff.length,
          customers: shop._count.customers,
          orders: shop._count.orders,
          conversations: shop._count.conversations,
        }}
        members={shop.staff}
        channels={shop.channelAccounts.map((account) => ({
          id: account.id,
          label: account.displayName || account.name || CHANNEL_LABEL[account.channel],
          status: CHANNEL_STATUS_LABEL[account.status] ?? account.status,
        }))}
        planCode={shop.planCode}
        planExpiresInput={planExpiryInputValue(shop.planExpiresAt)}
        supportStatus={shop.supportStatus}
        supportTopic={shop.supportTopic}
        supportNote={shop.supportNote}
      />
    </div>
  );
}
