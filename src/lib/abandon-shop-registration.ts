import { isAdminRole } from "@/lib/rbac-catalog";

export type AbandonShopRegistrationSnapshot = {
  isSuperAdmin: boolean;
  role: string;
  setupCompletedAt: Date | null;
  actorStaffId: string;
  staffIds: string[];
  channelCount: number;
};

/** Chỉ hủy shop chưa cấu hình xong, đúng 1 chủ shop, chưa nối kênh. */
export function abandonIncompleteShopReason(input: AbandonShopRegistrationSnapshot): string | null {
  if (input.isSuperAdmin) {
    return "Tài khoản nền tảng không hủy shop này được.";
  }
  if (!isAdminRole(input.role)) {
    return "Chỉ chủ shop vừa đăng ký mới hủy được.";
  }
  if (input.setupCompletedAt) {
    return "Cửa hàng đã cấu hình xong, không hủy đăng ký được.";
  }
  if (input.staffIds.length !== 1 || input.staffIds[0] !== input.actorStaffId) {
    return "Shop đã có thành viên khác, không hủy đăng ký được.";
  }
  if (input.channelCount > 0) {
    return "Shop đã nối kênh, không hủy đăng ký được.";
  }
  return null;
}
