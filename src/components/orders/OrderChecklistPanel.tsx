"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  attachOrderChecklistAction,
  toggleOrderChecklistAction,
} from "@/app/(app)/actions";

export type OrderChecklistItemView = {
  id: string;
  label: string;
  done: boolean;
  doneAt: string | null;
};

function itemsKey(items: OrderChecklistItemView[]) {
  return items.map((item) => `${item.id}:${item.done ? 1 : 0}`).join("|");
}

export function OrderChecklistPanel({
  orderId,
  items,
  canToggle,
}: {
  orderId: string;
  items: OrderChecklistItemView[];
  canToggle: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(items);
  const [syncedKey, setSyncedKey] = useState(() => itemsKey(items));
  const [error, setError] = useState<string | null>(null);

  const nextKey = itemsKey(items);
  if (nextKey !== syncedKey) {
    setSyncedKey(nextKey);
    setLocalItems(items);
  }

  if (localItems.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Đơn này chưa có checklist. Gắn các mục đang bật từ Cài đặt để tick vận hành.
        </p>
        {canToggle ? (
          <button
            type="button"
            disabled={pending}
            className="btn-secondary min-h-11 px-4"
            aria-busy={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await attachOrderChecklistAction(orderId);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {pending ? "Đang gắn…" : "Gắn checklist cho đơn này"}
          </button>
        ) : (
          <p className="text-xs text-slate-500">Cần quyền cập nhật đơn để gắn checklist.</p>
        )}
        {error ? (
          <p role="alert" aria-live="assertive" className="alert-error text-xs">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const doneCount = localItems.filter((item) => item.done).length;

  return (
    <div className="space-y-2" aria-busy={pending}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Checklist {doneCount}/{localItems.length}
      </p>
      {error ? (
        <p role="alert" aria-live="assertive" className="alert-error text-xs">
          {error}
        </p>
      ) : null}
      <ul className="space-y-1">
        {localItems.map((item) => (
          <li key={item.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-surface/80">
              <input
                type="checkbox"
                className="size-5 shrink-0 rounded border"
                checked={item.done}
                disabled={!canToggle || pending}
                aria-label={item.label}
                onChange={(event) => {
                  const done = event.target.checked;
                  const previous = item.done;
                  setError(null);
                  setLocalItems((current) =>
                    current.map((row) => (row.id === item.id ? { ...row, done } : row)),
                  );
                  startTransition(async () => {
                    const result = await toggleOrderChecklistAction(orderId, item.id, done);
                    if (!result.ok) {
                      setLocalItems((current) =>
                        current.map((row) =>
                          row.id === item.id ? { ...row, done: previous } : row,
                        ),
                      );
                      setError(result.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
              />
              <span className={item.done ? "text-slate-500 line-through" : ""}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
