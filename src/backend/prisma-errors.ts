/** Unique / conflict (P2002) — mã đơn, mã SP, identity, hội thoại. */
export function isUniqueConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /P2002|unique constraint|Unique constraint/i.test(message);
}

/** Nhận diện lỗi Prisma khi DB chưa migrate cột mới (P2022 / column does not exist). */
export function isMissingDbColumnError(error: unknown, columnHint?: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/P2022|does not exist|Unknown column|column .* does not exist/i.test(message)) {
    return false;
  }
  if (!columnHint) return true;
  return message.toLowerCase().includes(columnHint.toLowerCase());
}
