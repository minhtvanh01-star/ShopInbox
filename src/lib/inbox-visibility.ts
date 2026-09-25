import type { Channel, ChannelStatus } from "./types";

/**
 * Inbox chỉ hiện hội thoại/tin của kênh đang nối.
 * Ngắt kết nối → ẩn (không xóa); nối lại → hiện lịch sử cũ.
 */
export function isInboxChannelVisible(status: ChannelStatus): boolean {
  return status === "ready";
}

export function visibleInboxChannels(
  accounts: Array<{ channel: Channel; status: ChannelStatus }>,
): Channel[] {
  const seen = new Set<Channel>();
  for (const account of accounts) {
    if (isInboxChannelVisible(account.status)) {
      seen.add(account.channel);
    }
  }
  return [...seen];
}
