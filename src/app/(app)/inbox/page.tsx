import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";
import { getChannelAccounts, getInboxData } from "@/lib/queries";
import type { Channel } from "@/lib/types";

export default async function InboxPage() {
  const [data, accounts] = await Promise.all([getInboxData(), getChannelAccounts()]);

  const activeChannels = [
    ...new Set<Channel>([
      ...accounts.filter((item) => item.status === "ready").map((item) => item.channel),
      ...data.conversations.map((item) => item.channel),
    ]),
  ];

  return <InboxWorkspace {...data} activeChannels={activeChannels} />;
}
