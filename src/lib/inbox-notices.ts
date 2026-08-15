import type { Channel } from "@/lib/types";

/** Client event — Sidebar lắng nghe để poll lại badge sau mark-read / gửi tin. */
export const INBOX_NOTICES_REFRESH_EVENT = "shopinbox:inbox-notices-refresh";

export function notifyInboxNoticesRefresh() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(INBOX_NOTICES_REFRESH_EVENT));
}

export type InboxNoticeItem = {
  conversationId: string;
  customerName: string;
  preview: string;
  unread: number;
  channel: Channel;
  lastAt: string;
  replyStaffName: string | null;
  replyActive: boolean;
};

export type InboxNoticeSummary = {
  unreadTotal: number;
  unreadConversations: number;
  notices: InboxNoticeItem[];
};
