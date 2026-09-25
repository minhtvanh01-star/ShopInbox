/** Giới hạn media Inbox / upload — dùng chung client + server (không import fs). */

export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MESSAGE_TEXT_MAX = 2000;

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_SPREADSHEET_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const ALLOWED_SPREADSHEET_EXT = new Set(["xlsx", "xls"]);

/** Placeholder text khi tin chỉ có media (không hiện lại trong bubble nếu đã render media). */
export const MEDIA_PLACEHOLDER_TEXT = new Set([
  "[Ảnh]",
  "[Video]",
  "[Audio]",
  "[File]",
  "[Đính kèm]",
]);

export function isMediaPlaceholderText(text: string | null | undefined) {
  return Boolean(text && MEDIA_PLACEHOLDER_TEXT.has(text));
}

export function uploadSizeError(label = "File") {
  return `${label} tối đa ${MAX_UPLOAD_MB}MB.`;
}

export function validateUploadSize(
  size: number,
  label = "File",
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: `${label} trống.` };
  }
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: uploadSizeError(label) };
  }
  return { ok: true };
}

export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function fileExtension(fileName: string) {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function sniffSpreadsheetKind(
  bytes: Uint8Array,
  fileName: string,
): "xlsx" | "xls" | null {
  if (bytes.length < 8) return null;
  const ext = fileExtension(fileName);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle =
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (ext === "xlsx" && isZip) return "xlsx";
  if (ext === "xls" && isOle) return "xls";
  return null;
}

export function validateImageFileForUpload(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  const sizeCheck = validateUploadSize(file.size, "Ảnh");
  if (!sizeCheck.ok) return sizeCheck;
  const mime = file.type || "";
  if (mime && !ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, error: "Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF." };
  }
  return { ok: true };
}

export function validateSpreadsheetFileForUpload(file: {
  type: string;
  size: number;
  name?: string;
}): { ok: true } | { ok: false; error: string } {
  const sizeCheck = validateUploadSize(file.size, "File Excel");
  if (!sizeCheck.ok) return sizeCheck;
  const ext = fileExtension(file.name ?? "");
  const mime = file.type || "";
  const typeOk =
    ALLOWED_SPREADSHEET_EXT.has(ext) || (mime ? ALLOWED_SPREADSHEET_MIME.has(mime) : false);
  if (!typeOk) {
    return { ok: false, error: "Chỉ hỗ trợ file Excel (.xlsx / .xls)." };
  }
  return { ok: true };
}

export function parseOutboundMessageText(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const body = String(raw ?? "").trim();
  if (!body) {
    return { ok: false, error: "Tin nhắn không hợp lệ." };
  }
  if (body.length > MESSAGE_TEXT_MAX) {
    return { ok: false, error: `Tin tối đa ${MESSAGE_TEXT_MAX} ký tự.` };
  }
  return { ok: true, value: body };
}
