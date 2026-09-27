import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";
import { visibleInboxChannels } from "@/lib/inbox-visibility";
import { getChannelAccounts, getInboxData, getShopContext } from "@/lib/queries";
import { isAdminRole, PERMISSION_CODES } from "@/lib/rbac-catalog";

type InboxPageProps = {
  searchParams: Promise<{ c?: string }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  const shop = await getShopContext();
  let data: Awaited<ReturnType<typeof getInboxData>>;
  let accounts: Awaited<ReturnType<typeof getChannelAccounts>> = [];
  try {
    [data, accounts] = await Promise.all([getInboxData(), getChannelAccounts()]);
  } catch (error) {
    console.error("[InboxPage] inbox data failed — empty workspace", error);
    data = {
      currentStaffId: shop.staffId,
      replyClaimTtlMinutes: shop.replyClaimTtlMinutes,
      conversations: [],
      messages: [],
      customers: [],
      orders: [],
      products: [],
      quickReplies: [],
    };
  }

  const activeChannels = visibleInboxChannels(accounts);

  const initialConversationId =
    typeof params.c === "string" && data.conversations.some((item) => item.id === params.c)
      ? params.c
      : undefined;

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
