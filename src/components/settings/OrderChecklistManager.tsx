"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createChecklistTemplateAction,
  deleteChecklistTemplateAction,
  updateChecklistTemplateAction,
  type ChecklistFormState,
} from "@/app/(app)/settings/actions";
import { CHECKLIST_LABEL_MAX, CHECKLIST_MAX_PER_SHOP } from "@/lib/order-checklist";

export type ChecklistTemplateView = {
  id: string;
  label: string;
  sortOrder: number;
  enabled: boolean;
};

const empty: ChecklistFormState = {};

export function OrderChecklistManager({ items }: { items: ChecklistTemplateView[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updateFlash, setUpdateFlash] = useState<ChecklistFormState>({});
  const [updatePending, startUpdate] = useTransition();
  const [createState, createAction, createPending] = useActionState(
    createChecklistTemplateAction,
    empty,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteChecklistTemplateAction,
    empty,
  );

  const flash = createState.success || updateFlash.success || deleteState.success;
  const flashError = createState.error || updateFlash.error || deleteState.error;
  const atLimit = items.length >= CHECKLIST_MAX_PER_SHOP;

  function submitUpdate(formData: FormData) {
    startUpdate(async () => {
      const result = await updateChecklistTemplateAction({}, formData);
      setUpdateFlash(result);
      if (!result.error) {
        setEditingId(null);
      }
    });
  }

  return (
    <section className="card-padded">
      <h2 className="text-sm font-semibold text-slate-900">Checklist đơn hàng</h2>
      <p className="mt-1 text-xs text-slate-500">
        Mục tick thủ công trên mỗi đơn (xác nhận SĐT, ship, thu tiền…). Đơn mới nhận các mục đang
        bật. Tối đa {CHECKLIST_MAX_PER_SHOP} mục / shop. Mỗi lần tick ghi nhật ký.
      </p>

      {flashError ? (
        <p role="alert" aria-live="assertive" className="alert-error mt-3">
          {flashError}
        </p>
      ) : null}
      {flash ? (
        <p role="status" aria-live="polite" className="alert-success mt-3">
          {flash}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-slate-500">
            Chưa có mục — thêm bên dưới (hoặc mở lại trang để seed mặc định).
          </li>
        ) : null}
        {items.map((item) => {
          const editing = editingId === item.id;
          return (
            <li key={item.id} className="rounded-xl border border-border bg-surface-muted/40 px-3 py-3">
              {editing ? (
                <form action={submitUpdate} className="space-y-2">
                  <input type="hidden" name="id" value={item.id} />
                  <label className="text-xs">
                    <span className="label">Nội dung</span>
                    <input
                      name="label"
                      required
                      maxLength={CHECKLIST_LABEL_MAX}
                      defaultValue={item.label}
                      className="input-field-sm min-h-11"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="label">Thứ tự</span>
                    <input
                      name="sortOrder"
                      type="number"
                      defaultValue={item.sortOrder}
                      className="input-field-sm min-h-11 w-28"
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={item.enabled}
                      className="size-5 rounded border"
                    />
                    Đang bật (gắn vào đơn mới)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={updatePending}
                      className="btn-primary-sm min-h-11"
                      aria-busy={updatePending}
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      className="btn-ghost min-h-11"
                      onClick={() => setEditingId(null)}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-[11px] text-slate-500">
                      Thứ tự {item.sortOrder} · {item.enabled ? "Bật" : "Tắt"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary min-h-11 px-3 text-xs"
                      onClick={() => setEditingId(item.id)}
                    >
                      Sửa
                    </button>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="btn-ghost min-h-11 px-3 text-xs text-rose-700"
                        onClick={(event) => {
                          if (!window.confirm(`Xóa mục «${item.label}»?`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        Xóa
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form action={createAction} className="mt-4 space-y-2 border-t border-border pt-4">
        <label className="text-xs">
          <span className="label">Thêm mục</span>
          <input
            name="label"
            required
            disabled={atLimit}
            maxLength={CHECKLIST_LABEL_MAX}
            placeholder="Ví dụ: Đã đóng gói"
            className="input-field-sm min-h-11"
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="enabled" defaultChecked className="size-5 rounded border" />
          Bật ngay
        </label>
        <button
          type="submit"
          disabled={createPending || atLimit}
          className="btn-primary-sm min-h-11"
          aria-busy={createPending}
        >
          {createPending ? "Đang thêm…" : "Thêm mục checklist"}
        </button>
      </form>
    </section>
  );
}
