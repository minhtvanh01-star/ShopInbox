/** Chuẩn hóa URL avatar khách (Meta/Zalo) — chỉ HTTPS. */
export function normalizeCustomerAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
