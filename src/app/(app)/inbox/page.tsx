import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";
import { getInboxData } from "@/lib/queries";

export default async function InboxPage() {
  const data = await getInboxData();
  return <InboxWorkspace {...data} />;
}
