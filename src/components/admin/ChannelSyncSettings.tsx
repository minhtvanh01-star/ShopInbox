"use client";

import { useActionState } from "react";
import {
  runChannelSyncNowAction,
  updateChannelSyncAction,
  type ChannelSyncActionState,
} from "@/app/(app)/admin/shops/actions";
import {
  CHANNEL_SYNC_MAX_SECONDS,
  CHANNEL_SYNC_MIN_SECONDS,
  formatChannelSyncInterval,
  splitChannelSyncInterval,
} from "@/lib/channel-sync";

const initial: ChannelSyncActionState = {};

export function ChannelSyncSettings({
  enabled,
  intervalSec,
  lastRunLabel,
}: {
  enabled: boolean;
  intervalSec: number;
  lastRunLabel: string | null;
}) {
  const [saveState, saveAction, savePending] = useActionState(updateChannelSyncAction, initial);
  const [runState, runAction, runPending] = useActionState(runChannelSyncNowAction, initial);
  const parts = splitChannelSyncInterval(intervalSec);

  return (
    <section className="card-padded mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Quét kênh</h2>
          <p className="mt-1 text-xs text-slate-500">
            Kéo tin Facebook / Instagram đã nối. Tự chạy mỗi {formatChannelSyncInterval(intervalSec)}.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
            enabled
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : "bg-slate-50 text-slate-600 ring-slate-200"
          }`}
        >
          {enabled ? "Đang bật" : "Đang tắt"}
        </span>
      </div>

      {saveState.error ? (
        <p role="alert" className="alert-error mt-3">
          {saveState.error}
        </p>
      ) : saveState.success ? (
        <p role="status" className="alert-success mt-3">
          {saveState.success}
        </p>
      ) : null}
      {runState.error ? (
        <p role="alert" className="alert-error mt-3">
          {runState.error}
        </p>
      ) : runState.success ? (
        <p role="status" className="alert-success mt-3">
          {runState.success}
        </p>
      ) : null}

      <form
        action={saveAction}
        key={`${enabled}-${intervalSec}`}
        className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
      >
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            name="channelSyncEnabled"
            value="1"
            defaultChecked={enabled}
            className="size-4 rounded border-slate-300 text-teal-700"
          />
          Bật quét tự động
        </label>
        <div className="field-group">
          <label htmlFor="channelSyncMinutes" className="label">
            Phút
          </label>
          <input
            id="channelSyncMinutes"
            name="minutes"
            type="number"
            min={0}
            max={60}
            required
            defaultValue={parts.minutes}
            className="input-field-sm"
          />
        </div>
        <div className="field-group">
          <label htmlFor="channelSyncSeconds" className="label">
            Giây
          </label>
          <input
            id="channelSyncSeconds"
            name="seconds"
            type="number"
            min={0}
            max={59}
            required
            defaultValue={parts.seconds}
            className="input-field-sm"
          />
        </div>
        <button type="submit" disabled={savePending} className="btn-primary min-h-11" aria-busy={savePending}>
          {savePending ? "Đang lưu…" : "Lưu"}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-slate-400">
        Từ {CHANNEL_SYNC_MIN_SECONDS} giây đến {CHANNEL_SYNC_MAX_SECONDS / 60} phút.
        {lastRunLabel ? ` Lần quét gần nhất: ${lastRunLabel}.` : " Chưa quét lần nào."}
      </p>

      <form action={runAction} className="mt-3">
        <button type="submit" disabled={runPending} className="btn-secondary" aria-busy={runPending}>
          {runPending ? "Đang quét…" : "Quét ngay"}
        </button>
      </form>
    </section>
  );
}
