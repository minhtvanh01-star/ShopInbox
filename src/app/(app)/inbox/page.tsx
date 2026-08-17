import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";
import { getChannelAccounts, getInboxData, getShopContext } from "@/lib/queries";
import { isAdminRole, PERMISSION_CODES } from "@/lib/rbac-catalog";
import type { Channel } from "@/lib/types";

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

  const activeChannels = [
    ...new Set<Channel>([
      ...accounts.filter((item) => item.status === "ready").map((item) => item.channel),
      ...data.conversations.map((item) => item.channel),
    ]),
  ];

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
    />
  );
}
