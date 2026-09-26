"use client";

import { useState } from "react";
import { checkWebsiteWidgetAction } from "@/app/(app)/settings/actions";

type WebWidgetCheckControlsProps = {
  urlInputId?: string;
  fallbackUrl?: string | null;
  canConnect: boolean;
  ready?: boolean;
};

export function WebWidgetCheckControls({
  urlInputId,
  fallbackUrl,
  canConnect,
  ready = false,
}: WebWidgetCheckControlsProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function resolveUrl() {
    if (urlInputId) {
      const input = document.getElementById(urlInputId);
      if (input instanceof HTMLInputElement && input.value.trim()) {
        return input.value.trim();
      }
    }
    return fallbackUrl?.trim() ?? "";
  }

  async function handleCheck() {
    if (!canConnect || checking) return;
    const url = resolveUrl();
    if (!url) {
      setResult({ ok: false, text: "Dán link website trước." });
      return;
    }
    setChecking(true);
    const formData = new FormData();
    formData.set("url", url);
    const next = await checkWebsiteWidgetAction(formData);
    setChecking(false);
    setResult({
      ok: Boolean(next.found),
      text: next.message ?? next.error ?? "Không kiểm tra được website.",
    });
  }

  const openUrl = resolveUrl();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={!canConnect || checking}
          className="btn-secondary"
        >
          {checking ? "Đang kiểm tra..." : "Kiểm tra website"}
        </button>
        {openUrl ? (
          <a
            href={openUrl.startsWith("http") ? openUrl : `https://${openUrl}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            Mở website
          </a>
        ) : null}
        {ready ? (
          <a href="/settings/web-preview" className="btn-ghost">
            Thử chat tại đây
          </a>
        ) : null}
      </div>
      {result ? (
        <p role="status" className={`text-xs leading-5 ${result.ok ? "text-emerald-600" : "text-amber-700"}`}>
          {result.text}
        </p>
      ) : (
        <p className="text-xs leading-5 text-slate-500">
          Kiểm tra HTML công khai xem đã có snippet ShopInbox (hoặc chat khác) chưa. Rồi bấm lưu để
          kết nối.
        </p>
      )}
    </div>
  );
}
