/** Che local-part: giữ 1–2 ký tự đầu/cuối, chèn *** ở giữa. */
export function maskEmail(raw: string | null | undefined) {
  const email = String(raw ?? "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "***";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || !domain) return "***";

  if (local.length === 1) {
    return `${local}***@${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}***${local[1]}@${domain}`;
  }

  const start = local.slice(0, 2);
  const end = local.length > 4 ? local.slice(-2) : local.slice(-1);
  return `${start}***${end}@${domain}`;
}

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Che mọi email trong chuỗi / JSON khi hiện nhật ký. */
export function maskEmailsInValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (!value.includes("@")) return value;
    return value.replace(EMAIL_IN_TEXT, (match) => maskEmail(match));
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskEmailsInValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        maskEmailsInValue(item),
      ]),
    );
  }
  return value;
}
