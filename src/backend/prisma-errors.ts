/** Unique / conflict (P2002) — mã đơn, mã SP, identity, hội thoại. */
export function isUniqueConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /P2002|unique constraint|Unique constraint/i.test(message);
}

/** Nhận diện lỗi Prisma khi DB chưa migrate cột mới (P2022 / column does not exist). */
export function isMissingDbColumnError(error: unknown, columnHint?: string) {
  const code =
    typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  if (
    code !== "P2022" &&
    !/P2022|does not exist|Unknown column|column .* does not exist|Unknown (?:arg|field|argument)/i.test(
      message,
    )
  ) {
    return false;
  }
  if (!columnHint) return true;
  return message.toLowerCase().includes(columnHint.toLowerCase());
}

/** Cột, enum, hoặc field Prisma lệch schema (code mới hơn migrate trên VPS). */
export function isPrismaSchemaDriftError(error: unknown) {
  if (isMissingDbColumnError(error)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /ShopPlan|ShopSupportStatus|ShopSupportTopic/i.test(message);
}
