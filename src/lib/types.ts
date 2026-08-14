export type Channel = "facebook" | "zalo" | "instagram" | "web";
export type ChannelStatus = "disconnected" | "ready";
export type StaffRole = "owner" | "staff";
export type ConversationTag = "new" | "consulting" | "closed" | "spam";
export type OrderStatus = "new" | "confirmed" | "shipping" | "done" | "cancelled";
export type MessageSender = "customer" | "shop";

export type ChannelAccount = {
  id: string;
  channel: Channel;
  name: string;
  status: ChannelStatus;
  note: string;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
};

export type Product = {
  id: string;
  name: string;
  sku?: string;
  price: number;
  inStock: boolean;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: MessageSender;
  text: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  channel: Channel;
  customerId: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  tag: ConversationTag;
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
