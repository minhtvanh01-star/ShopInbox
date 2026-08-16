/** Giới hạn số thành viên đang hoạt động trên mỗi shop (gồm admin/chủ). */
export const MAX_USERS_PER_SHOP = 3;

export function shopSeatLimitMessage(max: number = MAX_USERS_PER_SHOP) {
  return `Shop đã đủ ${max} thành viên đang hoạt động. Hãy vô hiệu hóa một tài khoản trước khi thêm hoặc kích hoạt người mới.`;
}

export function canAddActiveShopSeat(activeCount: number, max: number = MAX_USERS_PER_SHOP) {
  return activeCount < max;
}
