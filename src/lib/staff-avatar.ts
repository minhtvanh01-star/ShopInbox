import { ALLOWED_IMAGE_MIME } from "@/lib/inbox-media";

export const STAFF_AVATAR_MAX_MB = 5;
export const STAFF_AVATAR_MAX_BYTES = STAFF_AVATAR_MAX_MB * 1024 * 1024;

const LOCAL_UPLOAD_RE = /^\/api\/uploads\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export function isAllowedStaffAvatarUrl(raw: string) {
  const value = raw.trim();
  if (!value) return true;
  if (/^https?:\/\/.+/i.test(value)) return true;
  if (value.includes("..")) return false;
  return LOCAL_UPLOAD_RE.test(value);
}

export function validateStaffAvatarFile(file: { type: string; size: number }):
  | { ok: true }
  | { ok: false; error: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "Chọn một ảnh để làm ảnh đại diện." };
  }
  if (file.size > STAFF_AVATAR_MAX_BYTES) {
    return { ok: false, error: `Ảnh đại diện tối đa ${STAFF_AVATAR_MAX_MB}MB.` };
  }
  const mime = file.type || "";
  if (mime && !ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, error: "Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF." };
  }
  return { ok: true };
}
