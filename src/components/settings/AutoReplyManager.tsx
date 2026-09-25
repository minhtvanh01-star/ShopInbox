"use client";

import { useActionState, useState } from "react";
import {
  createAutoReplyRuleAction,
  deleteAutoReplyRuleAction,
  type AutoReplyFormState,
} from "@/app/(app)/settings/actions";
import {
  AUTO_REPLY_MAX_PER_SHOP,
  AUTO_REPLY_TEXT_MAX,
  formatHourMinute,
} from "@/lib/auto-reply";

export type AutoReplyRuleView = {
  id: string;
  enabled: boolean;
  kind: string;
  keywords: string;
  replyText: string;
  openMinute: number | null;
  closeMinute: number | null;
  cooldownMinutes: number;
};

type AutoReplyManagerProps = {
  items: AutoReplyRuleView[];
};

const empty: AutoReplyFormState = {};

export function AutoReplyManager({ items }: AutoReplyManagerProps) {
  const [kind, setKind] = useState<"off_hours" | "keyword">("keyword");
  const [createState, createAction, createPending] = useActionState(
    createAutoReplyRuleAction,
    empty,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAutoReplyRuleAction,
    empty,
  );

  const flash = createState.success || deleteState.success;
  const flashError = createState.error || deleteState.error;
  const atLimit = items.length >= AUTO_REPLY_MAX_PER_SHOP;

  return (
    <section className="card-padded">
      <h2 className="text-sm font-semibold text-slate-900">Trả lời tự động</h2>
      <p className="mt-1 text-xs text-slate-500">
        Keyword được ưu tiên hơn ngoài giờ. Cooldown tránh spam cùng một hội thoại. Sync lịch sử
        Meta không kích hoạt auto-reply. Tối đa {AUTO_REPLY_MAX_PER_SHOP} rule.
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
            Chưa có rule — thêm bên dưới.
          </li>
        ) : null}
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-border bg-surface-muted/40 px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {item.kind === "off_hours" ? "Ngoài giờ" : "Từ khóa"}
                  {!item.enabled ? (
                    <span className="ml-2 text-xs font-medium text-slate-400">(tắt)</span>
                  ) : null}
                </p>
                {item.kind === "keyword" ? (
                  <p className="mt-1 text-xs text-slate-500">Từ khóa: {item.keywords}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Giờ mở cửa VN:{" "}
                    {item.openMinute !== null && item.closeMinute !== null
                      ? `${formatHourMinute(item.openMinute)} – ${formatHourMinute(item.closeMinute)}`
                      : "—"}
                  </p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{item.replyText}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Cooldown {item.cooldownMinutes} phút
                </p>
              </div>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="btn-ghost min-h-9 px-3 py-1.5 text-xs text-rose-700"
                  onClick={(event) => {
                    if (!window.confirm("Xóa rule này?")) event.preventDefault();
                  }}
                >
                  Xóa
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <form action={createAction} className="mt-5 space-y-3 border-t border-border pt-4">
        <p className="text-xs font-semibold text-slate-800">Thêm rule</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-9 items-center gap-2 text-xs">
            <input
              type="radio"
              name="kind"
              value="keyword"
              checked={kind === "keyword"}
              onChange={() => setKind("keyword")}
            />
            Từ khóa
          </label>
          <label className="inline-flex min-h-9 items-center gap-2 text-xs">
            <input
              type="radio"
              name="kind"
              value="off_hours"
              checked={kind === "off_hours"}
              onChange={() => setKind("off_hours")}
            />
            Ngoài giờ
          </label>
        </div>

        {kind === "keyword" ? (
          <input
            name="keywords"
            required
            placeholder="vd. giá, ship, còn hàng"
            disabled={atLimit || createPending}
            className="input-field-sm min-h-11"
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="openTime" className="label">
                Mở cửa (VN)
              </label>
              <input
                id="openTime"
                name="openTime"
                type="time"
                required
                defaultValue="09:00"
                disabled={atLimit || createPending}
                className="input-field-sm min-h-11"
              />
            </div>
            <div>
              <label htmlFor="closeTime" className="label">
                Đóng cửa (VN)
              </label>
              <input
                id="closeTime"
                name="closeTime"
                type="time"
                required
                defaultValue="18:00"
                disabled={atLimit || createPending}
                className="input-field-sm min-h-11"
              />
            </div>
          </div>
        )}

        <textarea
          name="replyText"
          required
          maxLength={AUTO_REPLY_TEXT_MAX}
          rows={3}
          placeholder="Nội dung gửi khách…"
          disabled={atLimit || createPending}
          className="input-field-sm min-h-20 resize-y"
        />
        <div className="field-group max-w-xs">
          <label htmlFor="cooldownMinutes" className="label">
            Cooldown (phút)
          </label>
          <input
            id="cooldownMinutes"
            name="cooldownMinutes"
            type="number"
            min={15}
            max={1440}
            defaultValue={120}
            disabled={atLimit || createPending}
            className="input-field-sm min-h-11"
          />
        </div>
        <label className="inline-flex min-h-9 items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" name="enabled" value="true" defaultChecked />
          Bật ngay
        </label>

        {atLimit ? (
          <p className="text-xs text-amber-700">Đã đủ {AUTO_REPLY_MAX_PER_SHOP} rule.</p>
        ) : null}
        <button
          type="submit"
          disabled={atLimit || createPending}
          className="btn-primary-sm min-h-9"
          aria-busy={createPending}
        >
          {createPending ? "Đang thêm…" : "Thêm rule"}
        </button>
      </form>
    </section>
  );
}
