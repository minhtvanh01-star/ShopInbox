"use server";

import { requireActionPermission } from "@/backend/rbac";
import { getInboxNotificationSummary } from "@/lib/queries";
import type { InboxNoticeSummary } from "@/lib/inbox-notices";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export async function fetchInboxNoticesAction(): Promise<InboxNoticeSummary> {
  await requireActionPermission(PERMISSION_CODES.inboxRead);
  return getInboxNotificationSummary();
}
