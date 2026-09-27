/** Trần ghế bản chạy thử (gồm admin/chủ) — shop mặc định 3, có thể tăng tới mức này. */
export const MAX_USERS_PER_SHOP = 5;

export function trialPlanSeatWarning(max: number = MAX_USERS_PER_SHOP) {
  return `Bản chạy thử: mặc định 3 người, có thể tăng tối đa ${max} người. Bản nâng cấp sẽ mở thêm ghế sau.`;
}

export function shopSeatLimitMessage(max: number = MAX_USERS_PER_SHOP) {
  return `Shop đã đủ ${max} thành viên đang hoạt động (bản chạy thử). Hãy vô hiệu hóa một tài khoản trước khi thêm hoặc kích hoạt người mới.`;
}

export function canAddActiveShopSeat(activeCount: number, max: number = MAX_USERS_PER_SHOP) {
  return activeCount < max;
}

/** Số nhân viên đang có / hạn ghế của shop (gói). */
export function formatShopSeatUsage(used: number, max: number = MAX_USERS_PER_SHOP) {
  return `${used}/${max}`;
}
