import type { Channel } from "@/lib/types";

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
