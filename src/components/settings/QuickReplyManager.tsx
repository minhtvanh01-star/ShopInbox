"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createQuickReplyAction,
  deleteQuickReplyAction,
  updateQuickReplyAction,
  type QuickReplyFormState,
} from "@/app/(app)/settings/actions";
import {
  QUICK_REPLY_MAX_PER_SHOP,
  QUICK_REPLY_TEXT_MAX,
  QUICK_REPLY_TITLE_MAX,
} from "@/lib/quick-reply";
import type { QuickReply } from "@/lib/types";

type QuickReplyManagerProps = {
  items: QuickReply[];
};

const emptyState: QuickReplyFormState = {};

export function QuickReplyManager({ items }: QuickReplyManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updateFlash, setUpdateFlash] = useState<QuickReplyFormState>({});
  const [updatePending, startUpdate] = useTransition();
  const [createState, createAction, createPending] = useActionState(
    createQuickReplyAction,
    emptyState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteQuickReplyAction,
    emptyState,
  );

  const flash = createState.success || updateFlash.success || deleteState.success;
  const flashError = createState.error || updateFlash.error || deleteState.error;
  const atLimit = items.length >= QUICK_REPLY_MAX_PER_SHOP;

  function submitUpdate(formData: FormData) {
    startUpdate(async () => {
      const result = await updateQuickReplyAction({}, formData);
      setUpdateFlash(result);
      if (!result.error) {
        setEditingId(null);
      }
    });
  }

  return (
    <section className="card-padded">
      <h2 className="text-sm font-semibold text-slate-900">Mẫu tin nhắn</h2>
      <p className="mt-1 text-xs text-slate-500">
        Tiêu đề hiện thành nút trong Inbox; bấm nút sẽ chèn nội dung vào ô soạn (chưa gửi ngay). Tối
        đa {QUICK_REPLY_MAX_PER_SHOP} mẫu / shop.
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

      <ul className="mt-4 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-slate-500">
            Chưa có mẫu nào — thêm bên dưới (hoặc chạy seed DB).
          </li>
        ) : null}
        {items.map((item) => {
          const editing = editingId === item.id;
          return (
            <li
              key={item.id}
              className="rounded-xl border border-border bg-surface-muted/40 px-3 py-3"
            >
              {editing ? (
                <form action={submitUpdate} className="space-y-2">
                  <input type="hidden" name="id" value={item.id} />
                  <label className="sr-only" htmlFor={`qr-title-${item.id}`}>
                    Tiêu đề mẫu
                  </label>
                  <input
                    id={`qr-title-${item.id}`}
                    name="title"
                    required
                    maxLength={QUICK_REPLY_TITLE_MAX}
                    defaultValue={item.title}
                    className="input-field-sm min-h-11"
                  />
                  <label className="sr-only" htmlFor={`qr-text-${item.id}`}>
                    Nội dung mẫu
                  </label>
                  <textarea
                    id={`qr-text-${item.id}`}
                    name="text"
                    required
                    maxLength={QUICK_REPLY_TEXT_MAX}
                    rows={3}
                    defaultValue={item.text}
                    className="input-field-sm min-h-20 resize-y"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={updatePending}
                      className="btn-primary-sm min-h-9"
                      aria-busy={updatePending}
                    >
                      {updatePending ? "Đang lưu…" : "Lưu"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost min-h-9"
                      onClick={() => {
                        setEditingId(null);
                        setUpdateFlash({});
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{item.text}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="btn-secondary min-h-9 px-3 py-1.5 text-xs"
                      onClick={() => {
                        setUpdateFlash({});
                        setEditingId(item.id);
                      }}
                    >
                      Sửa
                    </button>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="btn-ghost min-h-9 px-3 py-1.5 text-xs text-rose-700"
                        aria-busy={deletePending}
                        onClick={(event) => {
                          if (!window.confirm(`Xóa mẫu «${item.title}»?`)) {
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

      <form action={createAction} className="mt-5 space-y-2 border-t border-border pt-4">
        <p className="text-xs font-semibold text-slate-800">Thêm mẫu mới</p>
        <input
          name="title"
          required
          maxLength={QUICK_REPLY_TITLE_MAX}
          placeholder="Tiêu đề (vd. Xin SĐT)"
          disabled={atLimit || createPending}
          className="input-field-sm min-h-11"
        />
        <textarea
          name="text"
          required
          maxLength={QUICK_REPLY_TEXT_MAX}
          rows={3}
          placeholder="Nội dung gửi khách…"
          disabled={atLimit || createPending}
          className="input-field-sm min-h-20 resize-y"
        />
        {atLimit ? (
          <p className="text-xs text-amber-700">
            Đã đủ {QUICK_REPLY_MAX_PER_SHOP} mẫu — xóa bớt để thêm mới.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={atLimit || createPending}
          className="btn-primary-sm min-h-9"
          aria-busy={createPending}
        >
          {createPending ? "Đang thêm…" : "Thêm mẫu tin"}
        </button>
      </form>
    </section>
  );
}
