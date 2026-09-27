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
