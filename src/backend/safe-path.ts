/** Chỉ cho phép đường dẫn nội bộ an toàn, chặn open-redirect kiểu //evil.com */
export function safeInternalPath(raw: string | null | undefined, fallback = "/inbox") {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}
