"use server";

import { getInboxNotificationSummary } from "@/lib/queries";
import type { InboxNoticeSummary } from "@/lib/inbox-notices";

export async function fetchInboxNoticesAction(): Promise<InboxNoticeSummary> {
  return getInboxNotificationSummary();
}
