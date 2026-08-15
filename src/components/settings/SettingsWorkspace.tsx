"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNEL_ACCENT, CONNECT_PLATFORMS } from "@/lib/channels";
import { CHANNEL_STATUS_LABEL, formatDateTime } from "@/lib/labels";
import {
  AddConnectionModal,
  OAUTH_ERROR_MESSAGES,
  type ChannelAccountView,
} from "./AddConnectionModal";
import { disconnectChannelAction, syncMetaChannelAction } from "@/app/(app)/settings/actions";
import type { PendingMetaPages } from "@/lib/oauth-types";

type SettingsWorkspaceProps = {
  channels: ChannelAccountView[];
  canConnect: boolean;
  metaOAuthConfigured: boolean;
  zaloOAuthConfigured: boolean;
  metaMissingEnvVars: string[];
  zaloMissingEnvVars: string[];
  metaWebhookUrl: string;
  zaloWebhookUrl: string;
  metaWebhookVerifyToken: string;
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

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn-ghost shrink-0 px-2 py-1 text-xs">
      {copied ? "Đã copy!" : label ?? "Copy"}
    </button>
  );
}

function PlatformIcon({ channel }: { channel: ChannelAccountView["channel"] }) {
  const platform = CONNECT_PLATFORMS.find((item) => item.channel === channel);
  const accent = platform?.accent ?? CHANNEL_ACCENT[channel];
  const letter = (platform?.name ?? channel).charAt(0).toUpperCase();

  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
      style={{ backgroundColor: accent }}
    >
      {letter}
    </span>
  );
}

export function SettingsWorkspace({
  channels,
  canConnect,
  metaOAuthConfigured,
  zaloOAuthConfigured,
  metaMissingEnvVars,
  zaloMissingEnvVars,
  metaWebhookUrl,
  zaloWebhookUrl,
  metaWebhookVerifyToken,
  pendingMetaPages,
  oauthFlash,
}: SettingsWorkspaceProps) {
  const [open, setOpen] = useState(Boolean(oauthFlash?.pickChannel || oauthFlash?.success || oauthFlash?.error));
  const [initialPlatformId, setInitialPlatformId] = useState<string | undefined>(
    oauthFlash?.pickChannel ?? oauthFlash?.success,
  );
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncFlash, setSyncFlash] = useState<{ channel: string; ok: boolean; text: string } | null>(
    null,
  );
  const router = useRouter();

  const connectedCount = channels.filter((item) => item.status === "ready").length;

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

  async function handleDisconnect(channel: ChannelAccountView["channel"]) {
    if (!canConnect || disconnecting) return;
    const confirmed = window.confirm("Ngắt kết nối kênh này? Token OAuth sẽ bị xóa trên server.");
    if (!confirmed) return;

    setDisconnecting(channel);
    const formData = new FormData();
    formData.set("channel", channel);
    await disconnectChannelAction({}, formData);
    setDisconnecting(null);
    router.refresh();
  }

  async function handleSyncMeta(channel: ChannelAccountView["channel"]) {
    if (!canConnect || syncing || (channel !== "facebook" && channel !== "instagram")) return;

    setSyncing(channel);
    const formData = new FormData();
    formData.set("channel", channel);
    const result = await syncMetaChannelAction({}, formData);
    setSyncing(null);
    setSyncFlash({
      channel,
      ok: Boolean(result.success),
      text: result.success ?? result.error ?? "Không đồng bộ được.",
    });
    router.refresh();
  }

  return (
    <>
      <header className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Cài đặt kênh</h1>
          <p className="page-subtitle">
            Kết nối Facebook, Instagram, Zalo OA qua OAuth — tin nhắn đồng bộ vào Inbox.
          </p>
        </div>
        {canConnect ? (
          <button type="button" onClick={() => openModal()} className="btn-primary-sm shrink-0">
            Thêm kết nối
          </button>
        ) : null}
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
              Một số biến OAuth chưa cấu hình trên server
              {[...metaMissingEnvVars, ...zaloMissingEnvVars].length > 0
                ? `: ${[...metaMissingEnvVars, ...zaloMissingEnvVars].join(", ")}`
                : ""}
              . Nút kết nối sẽ bị khóa cho đến khi điền đủ trong{" "}
              <code className="rounded bg-white/70 px-1">.env</code> rồi restart server.
            </span>
          ) : null}
        </p>
      </div>

      {channels.length === 0 ? (
        <div className="empty-state m-6">
          <p className="text-base font-medium text-slate-700">Chưa có kênh nào</p>
          <p className="mt-1 text-sm text-slate-500">
            {canConnect
              ? 'Bấm "Thêm kết nối" để bắt đầu OAuth.'
              : "Liên hệ admin shop để kết nối kênh."}
          </p>
          {canConnect ? (
            <button type="button" onClick={() => openModal()} className="btn-primary mt-4">
              Thêm kết nối
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 p-6 md:grid-cols-2">
          {channels.map((channel) => (
            <article key={channel.id} className="card-padded transition hover:border-teal-200">
              <div className="flex items-start gap-3">
                <PlatformIcon channel={channel.channel} />
                <div className="min-w-0 flex-1">
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
                      {channel.status === "ready" ? "Đã nối" : CHANNEL_STATUS_LABEL[channel.status]}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-500">{channel.note}</p>

                  {channel.connectedAt ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Kết nối: {formatDateTime(channel.connectedAt)}
                    </p>
                  ) : null}

                  {channel.lastWebhookAt ? (
                    <p className="mt-1 text-xs text-emerald-600">
                      Webhook gần nhất: {formatDateTime(channel.lastWebhookAt)}
                    </p>
                  ) : channel.status === "ready" ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-amber-700">
                        OAuth đã nối, nhưng Inbox chỉ có tin khi webhook chạy hoặc khi bấm đồng bộ.
                        Tin trên Meta Business Suite không tự chảy sang ShopInbox.
                      </p>
                      {(channel.channel === "facebook" || channel.channel === "instagram") &&
                      metaWebhookUrl ? (
                        <div className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                          <p className="text-[11px] font-medium text-amber-900">
                            Webhook URL (Meta Developers → Messenger → Webhooks)
                          </p>
                          <div className="mt-1 flex items-start gap-2">
                            <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-700">
                              {metaWebhookUrl}
                            </code>
                            <CopyButton value={metaWebhookUrl} />
                          </div>
                          {metaWebhookVerifyToken ? (
                            <div className="mt-2">
                              <p className="text-[11px] text-amber-800">Verify token</p>
                              <div className="mt-1 flex items-start gap-2">
                                <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-700">
                                  {metaWebhookVerifyToken}
                                </code>
                                <CopyButton value={metaWebhookVerifyToken} label="Copy token" />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {syncFlash?.channel === channel.channel ? (
                    <p
                      className={`mt-2 text-xs ${syncFlash.ok ? "text-emerald-600" : "text-amber-700"}`}
                    >
                      {syncFlash.text}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openModal(channel.channel)}
                      className="btn-secondary"
                    >
                      {channel.status === "ready" ? "Xem kết nối" : "Kết nối kênh"}
                    </button>
                    {canConnect &&
                    channel.status === "ready" &&
                    channel.hasOAuthToken &&
                    (channel.channel === "facebook" || channel.channel === "instagram") ? (
                      <button
                        type="button"
                        onClick={() => handleSyncMeta(channel.channel)}
                        disabled={syncing === channel.channel}
                        className="btn-secondary"
                      >
                        {syncing === channel.channel ? "Đang đồng bộ..." : "Đồng bộ tin nhắn"}
                      </button>
                    ) : null}
                    {canConnect && channel.status === "ready" && channel.hasOAuthToken ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnect(channel.channel)}
                        disabled={disconnecting === channel.channel}
                        className="btn-ghost text-red-700 hover:bg-red-50"
                      >
                        {disconnecting === channel.channel ? "Đang ngắt..." : "Ngắt kết nối"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {connectedCount === 0 && channels.length > 0 ? (
        <div className="mx-6 mb-6 rounded-xl border border-dashed border-teal-200 bg-accent-muted/30 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-700">Chưa kênh nào ở trạng thái &quot;Đã nối&quot;</p>
          <button type="button" onClick={() => openModal()} className="btn-primary-sm mt-3">
            Kết nối kênh đầu tiên
          </button>
        </div>
      ) : null}

      {open ? (
        <AddConnectionModal
          channels={channels}
          canConnect={canConnect}
          metaOAuthConfigured={metaOAuthConfigured}
          zaloOAuthConfigured={zaloOAuthConfigured}
          metaMissingEnvVars={metaMissingEnvVars}
          zaloMissingEnvVars={zaloMissingEnvVars}
          metaWebhookUrl={metaWebhookUrl}
          zaloWebhookUrl={zaloWebhookUrl}
          metaWebhookVerifyToken={metaWebhookVerifyToken}
          pendingMetaPages={pendingMetaPages}
          initialPlatformId={initialPlatformId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
