import type { ReactNode } from "react";
import { SessionIdleGuard } from "@/components/auth/SessionIdleGuard";
import { Sidebar } from "@/components/Sidebar";
import { getInboxNotificationSummary, getShopContext } from "@/lib/queries";
import type { InboxNoticeSummary } from "@/lib/inbox-notices";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

const EMPTY_INBOX_NOTICES: InboxNoticeSummary = {
  unreadTotal: 0,
  unreadConversations: 0,
  notices: [],
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const shop = await getShopContext();
  let inboxNotices = EMPTY_INBOX_NOTICES;
  if (!shop.isSuperAdmin && shop.permissions.includes(PERMISSION_CODES.inboxRead)) {
    try {
      inboxNotices = await getInboxNotificationSummary();
    } catch (error) {
      console.error("[AppLayout] inbox notices failed — rendering without badge", error);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SessionIdleGuard />
      <Sidebar
        shopName={shop.shopName}
        staffName={shop.staffName}
        staffAvatarUrl={shop.staffAvatarUrl}
        roleLabel={shop.roleLabel}
        permissions={shop.permissions}
        isSuperAdmin={shop.isSuperAdmin}
        inboxNotices={inboxNotices}
      />
      <main id="main-content" className="flex min-h-0 min-w-0 flex-1 flex-col pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
