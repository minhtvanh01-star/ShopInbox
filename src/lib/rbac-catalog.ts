/** Nguồn cấu hình vai trò / quyền / nhãn audit. Seed đọc file này — thêm manager không cần sửa if-role. */

export const ROLE_CODES = {
  admin: "admin",
  staff: "staff",
  manager: "manager",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

/** JWT / seed cũ dùng `owner` — map về `admin`. */
export const ROLE_CODE_ALIASES: Record<string, string> = {
  owner: ROLE_CODES.admin,
};

export const PERMISSION_CODES = {
  inboxRead: "inbox.read",
  inboxReply: "inbox.reply",
  ordersRead: "orders.read",
  ordersUpdate: "orders.update",
  ordersCreate: "orders.create",
  productsManage: "products.manage",
  customersRead: "customers.read",
  customersUpdate: "customers.update",
  channelsConnect: "channels.connect",
  staffRead: "staff.read",
  staffManage: "staff.manage",
  auditRead: "audit.read",
  settingsUpdate: "settings.update",
  profileUpdate: "profile.update",
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export type CatalogPermission = {
  code: PermissionCode;
  name: string;
  description: string;
  group: string;
};

export const PERMISSIONS: CatalogPermission[] = [
  {
    code: PERMISSION_CODES.inboxRead,
    name: "Xem inbox",
    description: "Xem danh sách hội thoại và tin nhắn.",
    group: "inbox",
  },
  {
    code: PERMISSION_CODES.inboxReply,
    name: "Trả lời inbox",
    description: "Gửi tin nhắn từ shop.",
    group: "inbox",
  },
  {
    code: PERMISSION_CODES.ordersRead,
    name: "Xem đơn hàng",
    description: "Xem danh sách đơn.",
    group: "orders",
  },
  {
    code: PERMISSION_CODES.ordersUpdate,
    name: "Cập nhật đơn",
    description: "Đổi trạng thái đơn hàng.",
    group: "orders",
  },
  {
    code: PERMISSION_CODES.ordersCreate,
    name: "Tạo đơn",
    description: "Tạo đơn từ hội thoại.",
    group: "orders",
  },
  {
    code: PERMISSION_CODES.productsManage,
    name: "Quản lý sản phẩm",
    description: "Thêm, sửa, xóa sản phẩm, nhóm và biến thể.",
    group: "products",
  },
  {
    code: PERMISSION_CODES.customersRead,
    name: "Xem khách",
    description: "Xem danh sách khách hàng.",
    group: "customers",
  },
  {
    code: PERMISSION_CODES.customersUpdate,
    name: "Sửa khách",
    description: "Cập nhật SĐT, địa chỉ, ghi chú khách hàng.",
    group: "customers",
  },
  {
    code: PERMISSION_CODES.channelsConnect,
    name: "Kết nối kênh",
    description: "OAuth / lưu cấu hình / ngắt kết nối kênh.",
    group: "channels",
  },
  {
    code: PERMISSION_CODES.staffRead,
    name: "Xem nhân viên",
    description: "Xem danh sách tài khoản nhân viên.",
    group: "staff",
  },
  {
    code: PERMISSION_CODES.staffManage,
    name: "Quản lý nhân viên",
    description: "Thêm, sửa vai trò nhân viên.",
    group: "staff",
  },
  {
    code: PERMISSION_CODES.auditRead,
    name: "Xem nhật ký",
    description: "Xem audit trail (ai làm gì).",
    group: "audit",
  },
  {
    code: PERMISSION_CODES.settingsUpdate,
    name: "Cài đặt shop",
    description: "Sửa cấu hình cửa hàng.",
    group: "settings",
  },
  {
    code: PERMISSION_CODES.profileUpdate,
    name: "Sửa hồ sơ",
    description: "Cập nhật hồ sơ cá nhân.",
    group: "profile",
  },
];

export type CatalogRole = {
  code: RoleCode;
  name: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
};

export const ROLES: CatalogRole[] = [
  {
    code: ROLE_CODES.admin,
    name: "Admin / Chủ shop",
    description: "Chủ shop — toàn quyền, gồm nhân viên và kết nối kênh.",
    isSystem: true,
    isActive: true,
    sortOrder: 10,
  },
  {
    code: ROLE_CODES.manager,
    name: "Quản lý",
    description: "Giống nhân viên, thêm xem nhật ký và danh sách nhân viên. Gán user khi cần — không sửa code.",
    isSystem: true,
    isActive: true,
    sortOrder: 20,
  },
  {
    code: ROLE_CODES.staff,
    name: "Nhân viên",
    description: "Inbox, đơn hàng, khách, hồ sơ cá nhân.",
    isSystem: true,
    isActive: true,
    sortOrder: 30,
  },
];

const STAFF_PERMISSIONS: PermissionCode[] = [
  PERMISSION_CODES.inboxRead,
  PERMISSION_CODES.inboxReply,
  PERMISSION_CODES.ordersRead,
  PERMISSION_CODES.ordersUpdate,
  PERMISSION_CODES.ordersCreate,
  PERMISSION_CODES.customersRead,
  PERMISSION_CODES.customersUpdate,
  PERMISSION_CODES.profileUpdate,
];

const MANAGER_PERMISSIONS: PermissionCode[] = [
  ...STAFF_PERMISSIONS,
  PERMISSION_CODES.productsManage,
  PERMISSION_CODES.auditRead,
  PERMISSION_CODES.staffRead,
];

/** Map mặc định role → quyền (seed). Admin nhận mọi quyền trong catalog. */
export const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  [ROLE_CODES.admin]: PERMISSIONS.map((item) => item.code),
  [ROLE_CODES.manager]: MANAGER_PERMISSIONS,
  [ROLE_CODES.staff]: STAFF_PERMISSIONS,
};

export const ROLE_LABEL: Record<string, string> = {
  [ROLE_CODES.admin]: "Admin / Chủ shop",
  [ROLE_CODES.manager]: "Quản lý",
  [ROLE_CODES.staff]: "Nhân viên",
  owner: "Admin / Chủ shop",
};

export const ROLE_BADGE_CLASS: Record<string, string> = {
  [ROLE_CODES.admin]: "bg-teal-50 text-teal-700 ring-teal-200",
  [ROLE_CODES.manager]: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  [ROLE_CODES.staff]: "bg-slate-100 text-slate-700 ring-slate-200",
  owner: "bg-teal-50 text-teal-700 ring-teal-200",
};

export const DEFAULT_ROLE_CODE = ROLE_CODES.staff;
export const BOOTSTRAP_ROLE_CODE = ROLE_CODES.admin;

export function normalizeRoleCode(code: string | null | undefined): string {
  if (!code) return DEFAULT_ROLE_CODE;
  const trimmed = code.trim();
  if (!trimmed) return DEFAULT_ROLE_CODE;
  const lower = trimmed.toLowerCase();
  if (lower in ROLE_CODE_ALIASES) {
    return ROLE_CODE_ALIASES[lower]!;
  }
  if (
    lower === ROLE_CODES.admin ||
    lower === ROLE_CODES.manager ||
    lower === ROLE_CODES.staff
  ) {
    return lower;
  }
  return ROLE_CODE_ALIASES[trimmed] ?? trimmed;
}

/** Admin / chủ shop (kể cả alias `owner`) — được trả lời Inbox không cần claim. */
export function isAdminRole(code: string | null | undefined): boolean {
  return normalizeRoleCode(code) === ROLE_CODES.admin;
}

export function roleLabel(code: string | null | undefined): string {
  const canonical = normalizeRoleCode(code);
  return ROLE_LABEL[canonical] ?? ROLE_LABEL[code ?? ""] ?? canonical;
}

export function roleBadgeClass(code: string | null | undefined): string {
  const canonical = normalizeRoleCode(code);
  return (
    ROLE_BADGE_CLASS[canonical] ??
    ROLE_BADGE_CLASS[code ?? ""] ??
    "bg-slate-100 text-slate-700 ring-slate-200"
  );
}

export function catalogPermissionsForRole(roleCode: string): readonly PermissionCode[] {
  const canonical = normalizeRoleCode(roleCode);
  if (canonical in ROLE_PERMISSIONS) {
    return ROLE_PERMISSIONS[canonical as RoleCode];
  }
  return [];
}

export function catalogHasPermission(roleCode: string, permission: string): boolean {
  return catalogPermissionsForRole(roleCode).includes(permission as PermissionCode);
}

export const AUDIT_ACTIONS = {
  authLogin: "auth.login",
  authLoginFail: "auth.login_fail",
  authRegister: "auth.register",
  authPasswordReset: "auth.password_reset",
  staffCreate: "staff.create",
  staffUpdate: "staff.update",
  staffDisable: "staff.disable",
  staffPasswordReset: "staff.password_reset",
  customerUpdate: "customer.update",
  channelConnect: "channel.connect",
  channelDisconnect: "channel.disconnect",
  channelCredentialsSave: "channel.credentials_save",
  orderCreate: "order.create",
  orderStatusChange: "order.status_change",
  profileUpdate: "profile.update",
  profilePasswordChange: "profile.password_change",
  messageSend: "message.send",
  messageReact: "message.react",
  conversationTagChange: "conversation.tag_change",
  conversationClaim: "conversation.claim",
  conversationRelease: "conversation.release",
  authLogout: "auth.logout",
  authSessionTimeout: "auth.session_timeout",
  settingsUpdate: "settings.update",
  shopSetup: "shop.setup",
  staffInviteCreate: "staff.invite_create",
  staffInviteAccept: "staff.invite_accept",
  staffInviteRevoke: "staff.invite_revoke",
  productCreate: "product.create",
  productUpdate: "product.update",
  productDelete: "product.delete",
  orderChecklistToggle: "order.checklist_toggle",
  shopSuspend: "shop.suspend",
  shopResume: "shop.resume",
  superAdminGrant: "staff.super_admin_grant",
  superAdminRevoke: "staff.super_admin_revoke",
  shopOpsUpdate: "shop.ops_update",
} as const;

export type AuditActionCode = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  [AUDIT_ACTIONS.authLogin]: "Đăng nhập",
  [AUDIT_ACTIONS.authLoginFail]: "Đăng nhập thất bại",
  [AUDIT_ACTIONS.authRegister]: "Đăng ký tài khoản",
  [AUDIT_ACTIONS.authPasswordReset]: "Đặt lại mật khẩu",
  [AUDIT_ACTIONS.staffCreate]: "Tạo nhân viên",
  [AUDIT_ACTIONS.staffUpdate]: "Cập nhật nhân viên",
  [AUDIT_ACTIONS.staffDisable]: "Vô hiệu hóa nhân viên",
  [AUDIT_ACTIONS.staffPasswordReset]: "Đặt lại mật khẩu nhân viên",
  [AUDIT_ACTIONS.customerUpdate]: "Cập nhật hồ sơ khách",
  [AUDIT_ACTIONS.channelConnect]: "Kết nối kênh",
  [AUDIT_ACTIONS.channelDisconnect]: "Ngắt kết nối kênh",
  [AUDIT_ACTIONS.channelCredentialsSave]: "Lưu cấu hình kênh",
  [AUDIT_ACTIONS.orderCreate]: "Tạo đơn hàng",
  [AUDIT_ACTIONS.orderStatusChange]: "Đổi trạng thái đơn",
  [AUDIT_ACTIONS.profileUpdate]: "Cập nhật hồ sơ",
  [AUDIT_ACTIONS.profilePasswordChange]: "Đổi mật khẩu",
  [AUDIT_ACTIONS.messageSend]: "Gửi tin nhắn",
  [AUDIT_ACTIONS.messageReact]: "Reaction tin nhắn",
  [AUDIT_ACTIONS.conversationTagChange]: "Đổi nhãn hội thoại",
  [AUDIT_ACTIONS.conversationClaim]: "Nhận trả lời hội thoại",
  [AUDIT_ACTIONS.conversationRelease]: "Nhả hội thoại",
  [AUDIT_ACTIONS.authLogout]: "Đăng xuất",
  [AUDIT_ACTIONS.authSessionTimeout]: "Hết phiên (không hoạt động)",
  [AUDIT_ACTIONS.settingsUpdate]: "Cập nhật cấu hình vận hành",
  [AUDIT_ACTIONS.shopSetup]: "Hoàn tất cấu hình shop",
  [AUDIT_ACTIONS.staffInviteCreate]: "Tạo lời mời nhân viên",
  [AUDIT_ACTIONS.staffInviteAccept]: "Nhận lời mời vào shop",
  [AUDIT_ACTIONS.staffInviteRevoke]: "Thu hồi lời mời nhân viên",
  [AUDIT_ACTIONS.productCreate]: "Thêm sản phẩm",
  [AUDIT_ACTIONS.productUpdate]: "Cập nhật sản phẩm",
  [AUDIT_ACTIONS.productDelete]: "Xóa sản phẩm",
  [AUDIT_ACTIONS.orderChecklistToggle]: "Tick checklist đơn",
  [AUDIT_ACTIONS.shopSuspend]: "Tạm khóa shop",
  [AUDIT_ACTIONS.shopResume]: "Mở lại shop",
  [AUDIT_ACTIONS.superAdminGrant]: "Gán Super admin",
  [AUDIT_ACTIONS.superAdminRevoke]: "Gỡ Super admin",
  [AUDIT_ACTIONS.shopOpsUpdate]: "Cập nhật gói / hỗ trợ shop",
};

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  Shop: "Cửa hàng",
  Staff: "Nhân viên",
  Order: "Đơn hàng",
  Conversation: "Hội thoại",
  Customer: "Khách hàng",
  Message: "Tin nhắn",
  ChannelAccount: "Kênh",
  Profile: "Hồ sơ",
  Session: "Phiên đăng nhập",
  ShopInvite: "Lời mời nhân viên",
  Product: "Sản phẩm",
  OrderChecklistTemplate: "Checklist đơn",
  OrderChecklistCheck: "Tick checklist",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

export function auditEntityLabel(entityType: string | null | undefined): string {
  if (!entityType) return "—";
  return AUDIT_ENTITY_LABEL[entityType] ?? entityType;
}

export function roleCodeForNewStaff(existingStaffCount: number): RoleCode {
  return existingStaffCount === 0 ? BOOTSTRAP_ROLE_CODE : DEFAULT_ROLE_CODE;
}

/** User đầu tiên tự kích hoạt; mọi đăng ký mở sau đó cần admin bật + phân quyền. */
export function isActiveForOpenRegistration(existingStaffCount: number): boolean {
  return existingStaffCount === 0;
}
