import type {
  ChannelAccount,
  Conversation,
  Customer,
  Message,
  Order,
  Product,
  QuickReply,
} from "./types";

export const SHOP = {
  id: "shop1",
  name: "Lily Boutique",
  staffId: "staff1",
  staffName: "Minh",
  role: "owner" as const,
  roleLabel: "Chủ shop",
};

export const channelAccounts: ChannelAccount[] = [
  {
    id: "ch-facebook",
    channel: "facebook",
    name: "Facebook Messenger",
    status: "disconnected",
    note: "Cần app Meta — làm sau khi duyệt UI",
  },
  {
    id: "ch-zalo",
    channel: "zalo",
    name: "Zalo OA",
    status: "disconnected",
    note: "Cần Official Account — làm sau",
  },
  {
    id: "ch-instagram",
    channel: "instagram",
    name: "Instagram DM",
    status: "disconnected",
    note: "Đi cùng Meta app",
  },
  {
    id: "ch-web",
    channel: "web",
    name: "Chat website",
    status: "ready",
    note: "Widget sẽ chạy thật, không cần duyệt MXH",
  },
];

export const products: Product[] = [
  { id: "p1", name: "Áo sơ mi trắng", sku: "SM-TRANG", price: 290000, inStock: true },
  { id: "p2", name: "Đầm hoa midi", sku: "DAM-HOA", price: 450000, inStock: true },
  { id: "p3", name: "Áo croptop be", sku: "CROP-BE", price: 220000, inStock: true },
  { id: "p4", name: "Đầm hoa", sku: "DAM-HOA-NHO", price: 390000, inStock: true },
];

export const customers: Customer[] = [
  { id: "c1", name: "Nguyễn An", phone: "0901 234 567", note: "Hay mua đầm. Size M." },
  { id: "c2", name: "Trần Bình", phone: "0912 888 333", address: "Cầu Giấy, Hà Nội", note: "Ở Hà Nội, thích freeship." },
  { id: "c3", name: "Lê Chi", phone: "0987 111 222", note: "Follow Instagram, thích màu be." },
  { id: "c4", name: "Phạm Dung", phone: "0933 444 555", note: "Khách web mới." },
  {
    id: "c5",
    name: "Hoàng Em",
    phone: "0976 222 111",
    address: "22 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    note: "Đã chốt 2 áo sơ mi.",
  },
  {
    id: "c6",
    name: "Vũ Giang",
    phone: "0908 777 666",
    address: "15 Trần Phú, Hải Châu, Đà Nẵng",
    note: "Khiếu nại chậm giao.",
  },
  { id: "c7", name: "Đỗ Hạnh", note: "Hỏi giá sỉ, chưa có SĐT." },
  { id: "c8", name: "Bùi Khoa", phone: "0965 121 212", note: "Vừa chat trên website." },
  {
    id: "c9",
    name: "Ngô Lan",
    phone: "0944 909 808",
    address: "88 Lê Lợi, Q.1, TP.HCM",
    note: "Đơn đã giao tuần trước.",
  },
  { id: "c10", name: "Mai Oanh", phone: "0922 303 404", note: "Hay hỏi mã giảm giá." },
];

export const conversations: Conversation[] = [
  {
    id: "cv1",
    channel: "facebook",
    customerId: "c1",
    lastMessage: "Shop còn size M không ạ?",
    lastAt: "2026-08-13T15:40:00+07:00",
    unread: 2,
    tag: "consulting",
  },
  {
    id: "cv2",
    channel: "zalo",
    customerId: "c2",
    lastMessage: "Ship Hà Nội bao lâu vậy shop?",
    lastAt: "2026-08-13T15:12:00+07:00",
    unread: 1,
    tag: "new",
  },
  {
    id: "cv3",
    channel: "instagram",
    customerId: "c3",
    lastMessage: "Màu be còn không ạ?",
    lastAt: "2026-08-13T14:50:00+07:00",
    unread: 1,
    tag: "consulting",
  },
  {
    id: "cv4",
    channel: "web",
    customerId: "c4",
    lastMessage: "Đầm hoa còn hàng không?",
    lastAt: "2026-08-13T14:20:00+07:00",
    unread: 0,
    tag: "new",
  },
  {
    id: "cv5",
    channel: "facebook",
    customerId: "c5",
    lastMessage: "Chốt 2 áo sơ mi trắng size L nha",
    lastAt: "2026-08-13T13:05:00+07:00",
    unread: 0,
    tag: "closed",
  },
  {
    id: "cv6",
    channel: "zalo",
    customerId: "c6",
    lastMessage: "Đơn mình giao chậm quá shop ơi",
    lastAt: "2026-08-13T11:30:00+07:00",
    unread: 3,
    tag: "consulting",
  },
  {
    id: "cv7",
    channel: "instagram",
    customerId: "c7",
    lastMessage: "Shop lấy sỉ được không?",
    lastAt: "2026-08-12T21:10:00+07:00",
    unread: 0,
    tag: "new",
  },
  {
    id: "cv8",
    channel: "web",
    customerId: "c8",
    lastMessage: "Cho mình xem bảng size với",
    lastAt: "2026-08-12T19:45:00+07:00",
    unread: 1,
    tag: "new",
  },
  {
    id: "cv9",
    channel: "facebook",
    customerId: "c9",
    lastMessage: "Nhận hàng rồi, đẹp lắm ạ",
    lastAt: "2026-08-12T16:00:00+07:00",
    unread: 0,
    tag: "closed",
  },
  {
    id: "cv10",
    channel: "zalo",
    customerId: "c10",
    lastMessage: "Có mã giảm giá không shop?",
    lastAt: "2026-08-12T10:15:00+07:00",
    unread: 0,
    tag: "consulting",
  },
];

export const messages: Message[] = [
  { id: "m1", conversationId: "cv1", sender: "customer", text: "Chào shop, mình xem đầm hoa trên page.", createdAt: "2026-08-13T15:28:00+07:00" },
  { id: "m2", conversationId: "cv1", sender: "shop", text: "Dạ chào chị, shop còn đủ size ạ.", createdAt: "2026-08-13T15:30:00+07:00" },
  { id: "m3", conversationId: "cv1", sender: "customer", text: "Shop còn size M không ạ?", createdAt: "2026-08-13T15:40:00+07:00" },

  { id: "m4", conversationId: "cv2", sender: "customer", text: "Mình ở Cầu Giấy.", createdAt: "2026-08-13T15:08:00+07:00" },
  { id: "m5", conversationId: "cv2", sender: "customer", text: "Ship Hà Nội bao lâu vậy shop?", createdAt: "2026-08-13T15:12:00+07:00" },

  { id: "m6", conversationId: "cv3", sender: "customer", text: "Áo croptop ảnh mới đăng đẹp quá.", createdAt: "2026-08-13T14:42:00+07:00" },
  { id: "m7", conversationId: "cv3", sender: "shop", text: "Dạ cảm ơn chị, em còn trắng và be ạ.", createdAt: "2026-08-13T14:45:00+07:00" },
  { id: "m8", conversationId: "cv3", sender: "customer", text: "Màu be còn không ạ?", createdAt: "2026-08-13T14:50:00+07:00" },

  { id: "m9", conversationId: "cv4", sender: "customer", text: "Đầm hoa còn hàng không?", createdAt: "2026-08-13T14:20:00+07:00" },

  { id: "m10", conversationId: "cv5", sender: "customer", text: "Áo sơ mi trắng còn L không?", createdAt: "2026-08-13T12:50:00+07:00" },
  { id: "m11", conversationId: "cv5", sender: "shop", text: "Còn ạ, 290.000/cái, shop gửi trong ngày.", createdAt: "2026-08-13T12:55:00+07:00" },
  { id: "m12", conversationId: "cv5", sender: "customer", text: "Chốt 2 áo sơ mi trắng size L nha", createdAt: "2026-08-13T13:05:00+07:00" },

  { id: "m13", conversationId: "cv6", sender: "customer", text: "Mình đặt hôm kia rồi.", createdAt: "2026-08-13T11:20:00+07:00" },
  { id: "m14", conversationId: "cv6", sender: "customer", text: "Đơn mình giao chậm quá shop ơi", createdAt: "2026-08-13T11:30:00+07:00" },

  { id: "m15", conversationId: "cv7", sender: "customer", text: "Shop lấy sỉ được không?", createdAt: "2026-08-12T21:10:00+07:00" },

  { id: "m16", conversationId: "cv8", sender: "customer", text: "Cho mình xem bảng size với", createdAt: "2026-08-12T19:45:00+07:00" },

  { id: "m17", conversationId: "cv9", sender: "shop", text: "Chị nhận hàng chưa ạ?", createdAt: "2026-08-12T15:40:00+07:00" },
  { id: "m18", conversationId: "cv9", sender: "customer", text: "Nhận hàng rồi, đẹp lắm ạ", createdAt: "2026-08-12T16:00:00+07:00" },

  { id: "m19", conversationId: "cv10", sender: "customer", text: "Có mã giảm giá không shop?", createdAt: "2026-08-12T10:15:00+07:00" },
];

export const orders: Order[] = [
  {
    id: "o1",
    code: "DH00012",
    customerId: "c5",
    conversationId: "cv5",
    items: [{ productId: "p1", name: "Áo sơ mi trắng", qty: 2, price: 290000 }],
    address: "22 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    status: "confirmed",
    createdAt: "2026-08-13T13:08:00+07:00",
  },
  {
    id: "o2",
    code: "DH00011",
    customerId: "c9",
    conversationId: "cv9",
    items: [{ productId: "p2", name: "Đầm hoa midi", qty: 1, price: 450000 }],
    address: "88 Lê Lợi, Q.1, TP.HCM",
    status: "done",
    createdAt: "2026-08-10T09:20:00+07:00",
  },
  {
    id: "o3",
    code: "DH00010",
    customerId: "c6",
    conversationId: "cv6",
    items: [{ productId: "p3", name: "Áo croptop be", qty: 1, price: 220000 }],
    address: "15 Trần Phú, Hải Châu, Đà Nẵng",
    status: "shipping",
    createdAt: "2026-08-11T16:40:00+07:00",
  },
];

export const quickReplies: QuickReply[] = [
  { id: "q1", title: "Còn hàng", text: "Dạ còn hàng ạ, chị lấy size nào ạ?" },
  { id: "q2", title: "Xin SĐT", text: "Chị cho shop số điện thoại và địa chỉ để chốt đơn ạ." },
  { id: "q3", title: "Ship trong ngày", text: "Shop gửi trong ngày, 1-2 ngày nhận ạ." },
];

export function customerById(id: string) {
  return customers.find((item) => item.id === id);
}

export function ordersByCustomer(customerId: string) {
  return orders.filter((item) => item.customerId === customerId);
}

export function messagesByConversation(conversationId: string) {
  return messages.filter((item) => item.conversationId === conversationId);
}
