export type Channel = "facebook" | "zalo" | "instagram" | "web";
export type StaffRole = "owner" | "staff";
export type ConversationTag = "new" | "consulting" | "closed" | "spam";
export type OrderStatus = "new" | "confirmed" | "shipping" | "done" | "cancelled";
export type MessageSender = "customer" | "shop";

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  note?: string;
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
