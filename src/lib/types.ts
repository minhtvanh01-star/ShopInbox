/** Shared domain types — frontend và backend cùng dùng (Channel, Order, ChannelAccount, …). */
export type Channel = "facebook" | "zalo" | "instagram" | "web";
export type ChannelStatus = "disconnected" | "connecting" | "ready";
/** Mã vai trò lấy từ bảng `roles` / catalog — không hardcode enum UI. */
export type StaffRole = string;
export type ConversationTag = "new" | "consulting" | "closed" | "spam";
export type OrderStatus = "new" | "confirmed" | "shipping" | "done" | "cancelled";
export type MessageSender = "customer" | "shop";

export type ChannelAccount = {
  id: string;
  channel: Channel;
  name: string;
  status: ChannelStatus;
  note: string;
  appId?: string | null;
  appSecret?: string | null;
  pageId?: string | null;
  webhookSecret?: string | null;
  oaId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  displayName?: string | null;
  expiresAt?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  avatarUrl?: string;
};

export type VatPolicy = "exempt" | "taxable" | "zero";

export type ProductGroup = {
  id: string;
  name: string;
  sortOrder: number;
};

export type ProductVariant = {
  id: string;
  sku?: string;
  name: string;
  price: number;
  costPrice: number;
  selling: boolean;
  sortOrder: number;
};

/** Sản phẩm cha (catalog). Giá bán nằm ở biến thể. */
export type Product = {
  id: string;
  code: string;
  name: string;
  groupId?: string | null;
  groupName?: string | null;
  vatPolicy: VatPolicy;
  taxRate?: number | null;
  selling: boolean;
  variants: ProductVariant[];
};

/** Dòng chọn khi tạo đơn — một biến thể đang bán. */
export type SellableVariant = {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  name: string;
  sku?: string | null;
  price: number;
  label: string;
};

export type MessageReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

/** Trạng thái gửi phía client (chưa commit DB / thất bại). */
export type MessageLocalStatus = "sending" | "failed";

export type Message = {
  id: string;
  conversationId: string;
  sender: MessageSender;
  text: string;
  createdAt: string;
  attachmentType?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  externalMessageId?: string | null;
  /** Khách đã nhận (Meta delivery watermark). */
  deliveredAt?: string | null;
  /** Khách đã xem (Meta read watermark). */
  readAt?: string | null;
  reactions?: MessageReactionSummary[];
  /** Chỉ dùng trên UI optimistic — không lưu DB. */
  localStatus?: MessageLocalStatus;
};

export type Conversation = {
  id: string;
  channel: Channel;
  customerId: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  tag: ConversationTag;
  /** Nhân viên đang claim trả lời (null nếu trống / hết hạn). */
  replyStaffId?: string | null;
  replyStaffName?: string | null;
  replyClaimedAt?: string | null;
};

export type OrderItem = {
  productId?: string;
  name: string;
  qty: number;
  price: number;
};

export type Order = {
  id: string;
  code: string;
  customerId: string;
  conversationId: string;
  items: OrderItem[];
  address: string;
  status: OrderStatus;
  createdAt: string;
};

export type QuickReply = {
  id: string;
  title: string;
  text: string;
};
