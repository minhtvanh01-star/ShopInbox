/** Validate mẫu tin nhanh (QuickReply). */

export const QUICK_REPLY_TITLE_MAX = 40;
export const QUICK_REPLY_TEXT_MAX = 1000;
export const QUICK_REPLY_MAX_PER_SHOP = 50;

export type QuickReplyInput = {
  title: string;
  text: string;
};

export function parseQuickReplyInput(raw: {
  title?: string | null;
  text?: string | null;
}): { ok: true; value: QuickReplyInput } | { ok: false; error: string } {
  const title = (raw.title ?? "").trim().replace(/\s+/g, " ");
  const text = (raw.text ?? "").trim();

  if (!title) {
    return { ok: false, error: "Nhập tiêu đề ngắn (hiện trên nút trong Inbox)." };
  }
  if (title.length > QUICK_REPLY_TITLE_MAX) {
    return { ok: false, error: `Tiêu đề tối đa ${QUICK_REPLY_TITLE_MAX} ký tự.` };
  }
  if (!text) {
    return { ok: false, error: "Nhập nội dung tin sẽ gửi cho khách." };
  }
  if (text.length > QUICK_REPLY_TEXT_MAX) {
    return { ok: false, error: `Nội dung tối đa ${QUICK_REPLY_TEXT_MAX} ký tự.` };
  }

  return { ok: true, value: { title, text } };
}
