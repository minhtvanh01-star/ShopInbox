"use client";

import { useMemo, useState } from "react";
import { CHANNEL_STATUS_LABEL } from "@/lib/labels";
import {
  AddConnectionModal,
  OAUTH_ERROR_MESSAGES,
  type ChannelAccountView,
} from "./AddConnectionModal";
import type { PendingMetaPages } from "@/lib/oauth-types";

type SettingsWorkspaceProps = {
  channels: ChannelAccountView[];
  isOwner: boolean;
  metaOAuthConfigured: boolean;
  zaloOAuthConfigured: boolean;
  metaWebhookUrl: string;
  zaloWebhookUrl: string;
  pendingMetaPages: PendingMetaPages | null;
  oauthFlash?: {
    success?: string;
    error?: string;
    errorMessage?: string;
    pickChannel?: string;
  };
};

function statusBadgeClass(status: ChannelAccountView["status"]) {
  if (status === "ready") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "connecting") {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export function SettingsWorkspace({
  channels,
  isOwner,
  metaOAuthConfigured,
  zaloOAuthConfigured,
  metaWebhookUrl,
  zaloWebhookUrl,
  pendingMetaPages,
  oauthFlash,
}: SettingsWorkspaceProps) {
  const [open, setOpen] = useState(Boolean(oauthFlash?.pickChannel || oauthFlash?.success || oauthFlash?.error));
  const [initialPlatformId, setInitialPlatformId] = useState<string | undefined>(
    oauthFlash?.pickChannel ?? oauthFlash?.success,
  );

  const flashMessage = useMemo(() => {
    if (oauthFlash?.success) {
      const label =
        oauthFlash.success === "facebook"
          ? "Facebook Messenger"
          : oauthFlash.success === "instagram"
            ? "Instagram DM"
            : oauthFlash.success === "zalo"
              ? "Zalo OA"
              : oauthFlash.success;
      return { type: "success" as const, text: `Đã kết nối ${label} thành công.` };
    }
    if (oauthFlash?.error) {
      const base = OAUTH_ERROR_MESSAGES[oauthFlash.error] ?? "Kết nối OAuth thất bại.";
      const text = oauthFlash.errorMessage ? `${base} (${oauthFlash.errorMessage})` : base;
      return { type: "error" as const, text };
    }
    return null;
  }, [oauthFlash]);

  function openModal(platformId?: string) {
    setInitialPlatformId(platformId);
    setOpen(true);
  }

  return (
    <>
      <header className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Cài đặt kênh</h1>
          <p className="page-subtitle">
            Kết nối Facebook, Instagram, Zalo OA qua OAuth — hoặc cấu hình chat website thủ công.
          </p>
        </div>
        <button type="button" onClick={() => openModal()} className="btn-primary-sm shrink-0">
          Thêm kết nối
        </button>
      </header>

      {flashMessage ? (
        <div
          className={`border-b px-6 py-3 text-sm ${
            flashMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="border-b border-border bg-accent-muted/40 px-6 py-3">
        <p className="text-sm text-slate-600">
          Thiết lập OAuth app & webhook:{" "}
          <span className="font-medium text-teal-800">docs/ket-noi-kenh.md</span>
          {!metaOAuthConfigured || !zaloOAuthConfigured ? (
            <span className="mt-1 block text-xs text-amber-700">
              Một số biến OAuth chưa cấu hình trên server — nút kết nối sẽ hiện thông báo liên hệ admin.
            </span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-2">
        {channels.map((channel) => (
          <article key={channel.id} className="card-padded transition hover:border-teal-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {channel.displayName ?? channel.name}
                </h2>
                {channel.displayName ? (
                  <p className="text-xs text-slate-400">{channel.name}</p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass(channel.status)}`}
              >
                {CHANNEL_STATUS_LABEL[channel.status]}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{channel.note}</p>
            {channel.hasOAuthToken ? (
              <p className="mt-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700 ring-1 ring-emerald-100">
                Token OAuth đã lưu trên server
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => openModal(channel.channel)}
              className="btn-secondary mt-4"
            >
              {channel.status === "ready" ? "Xem kết nối" : "Kết nối kênh"}
            </button>
          </article>
        ))}
      </div>

      {open ? (
        <AddConnectionModal
          channels={channels}
          isOwner={isOwner}
          metaOAuthConfigured={metaOAuthConfigured}
          zaloOAuthConfigured={zaloOAuthConfigured}
          metaWebhookUrl={metaWebhookUrl}
          zaloWebhookUrl={zaloWebhookUrl}
          pendingMetaPages={pendingMetaPages}
          initialPlatformId={initialPlatformId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
