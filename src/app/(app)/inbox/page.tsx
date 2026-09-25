import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";
import { visibleInboxChannels } from "@/lib/inbox-visibility";
import { getChannelAccounts, getInboxData, getShopContext } from "@/lib/queries";
import { isAdminRole, PERMISSION_CODES } from "@/lib/rbac-catalog";

type InboxPageProps = {
  searchParams: Promise<{ c?: string }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  const [data, accounts, shop] = await Promise.all([
    getInboxData(),
    getChannelAccounts(),
    getShopContext(),
  ]);

  const activeChannels = visibleInboxChannels(accounts);

  const initialConversationId =
    typeof params.c === "string" && data.conversations.some((item) => item.id === params.c)
      ? params.c
      : undefined;

  // roleCode + quyền admin-only (staff.manage) — tránh lệch casing / seed quyền.
  const isAdmin =
    isAdminRole(shop.role) || shop.permissions.includes(PERMISSION_CODES.staffManage);

  return (
    <InboxWorkspace
      {...data}
      currentStaffName={shop.staffName}
      isAdmin={isAdmin}
      replyClaimTtlMinutes={data.replyClaimTtlMinutes ?? shop.replyClaimTtlMinutes}
      activeChannels={activeChannels}
      initialConversationId={initialConversationId}
      canUpdateCustomer={
        shop.permissions.includes(PERMISSION_CODES.customersUpdate) ||
        shop.permissions.includes(PERMISSION_CODES.inboxReply)
      }
      canMergeOrders={shop.permissions.includes(PERMISSION_CODES.ordersUpdate)}
    />
  );
}
