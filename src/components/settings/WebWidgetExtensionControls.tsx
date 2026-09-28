"use client";

import { useState } from "react";
import {
  WEB_WIDGET_EXTENSION_ATTR,
  buildWebWidgetExtensionPair,
} from "@/lib/web-widget-extension";

export function WebWidgetExtensionControls({
  widgetKey,
  websiteHost,
}: {
  widgetKey: string;
  websiteHost: string;
}) {
  const [status, setStatus] = useState<string | null>(null);

  function pair() {
    const payload = buildWebWidgetExtensionPair({
      appOrigin: window.location.origin,
      widgetKey,
      websiteHost,
    });
    if (!payload) {
      setStatus("Thiếu domain hoặc widget key.");
      return;
    }
    document.documentElement.setAttribute(WEB_WIDGET_EXTENSION_ATTR, JSON.stringify(payload));
    setStatus("Bấm icon Nexo trên Chrome (đúng tab Cài đặt này), rồi xác nhận gắn.");
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={pair} className="btn-secondary">
        Gửi sang tiện ích Chrome
      </button>
      <p className="text-[11px] leading-5 text-slate-500">
        Tiện ích hiện chat trên trình duyệt này để xem thử. Khách vào site thật vẫn cần dán snippet
        vào HTML / theme.
      </p>
      {status ? (
        <p role="status" className="text-xs leading-5 text-teal-800">
          {status}
        </p>
      ) : null}
    </div>
  );
}
