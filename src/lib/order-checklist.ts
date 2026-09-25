/** Checklist vận hành đơn — cấu hình shop, tick thủ công trên từng đơn. */

export const CHECKLIST_LABEL_MAX = 80;
export const CHECKLIST_MAX_PER_SHOP = 20;

export const DEFAULT_ORDER_CHECKLIST_LABELS = [
  "Xác nhận SĐT với khách",
  "Xác nhận địa chỉ giao",
  "Đã báo khách / chốt đơn",
  "Đã bàn giao vận chuyển",
  "Đã thu tiền / COD",
] as const;

export type ChecklistTemplateInput = {
  label: string;
  enabled: boolean;
  sortOrder: number;
};

export function parseChecklistTemplateInput(raw: {
  label?: string | null;
  enabled?: string | boolean | null;
  sortOrder?: string | number | null;
}): { ok: true; value: ChecklistTemplateInput } | { ok: false; error: string } {
  const label = (raw.label ?? "").trim().replace(/\s+/g, " ");
  if (!label) {
    return { ok: false, error: "Nhập nội dung mục checklist." };
  }
  if (label.length > CHECKLIST_LABEL_MAX) {
    return { ok: false, error: `Tối đa ${CHECKLIST_LABEL_MAX} ký tự.` };
  }

  const enabled =
    raw.enabled === undefined ||
    raw.enabled === null ||
    raw.enabled === true ||
    raw.enabled === "true" ||
    raw.enabled === "1" ||
    raw.enabled === "on";

  let sortOrder = 0;
  if (typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)) {
    sortOrder = Math.round(raw.sortOrder);
  } else if (raw.sortOrder != null && String(raw.sortOrder).trim()) {
    const parsed = Number(String(raw.sortOrder).trim());
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: "Thứ tự không hợp lệ." };
    }
    sortOrder = Math.round(parsed);
  }

  return { ok: true, value: { label, enabled, sortOrder } };
}
