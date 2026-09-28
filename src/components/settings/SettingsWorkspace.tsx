"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNEL_ACCENT, CONNECT_PLATFORMS } from "@/lib/channels";
import { CHANNEL_STATUS_LABEL, formatDateTime, oauthSwitchPageLabel } from "@/lib/labels";
import {
  AddConnectionModal,
  type ChannelAccountView,
} from "./AddConnectionModal";
import { WebWidgetCheckControls } from "./WebWidgetCheckControls";
import { WebWidgetExtensionControls } from "./WebWidgetExtensionControls";
import { QuickReplyManager } from "./QuickReplyManager";
import { AutoReplyManager, type AutoReplyRuleView } from "./AutoReplyManager";
import {
  OrderChecklistManager,
  type ChecklistTemplateView,
} from "./OrderChecklistManager";
import { ShopPolicyForm } from "./ShopPolicyForm";
import { NexoMark } from "@/components/brand/NexoMark";
import {
  disconnectChannelAction,
  rotateWebWidgetKeyAction,
  syncMetaChannelAction,
} from "@/app/(app)/settings/actions";
import type { PendingMetaPages } from "@/lib/oauth-types";
import {
  formatOAuthFlashError,
  formatOAuthFlashSuccess,
  formatOAuthFlashWarning,
} from "@/lib/oauth-flash";
import type { QuickReply } from "@/lib/types";

type SettingsWorkspaceProps = {
  channels: ChannelAccountView[];
  canConnect: boolean;
  canUpdateSettings: boolean;
  shopName: string;
  replyClaimTtlMinutes: number;
  maxUsersPerShop: number;
  quickReplies: QuickReply[];
  autoReplyRules: AutoReplyRuleView[];
  checklistTemplates: ChecklistTemplateView[];
  metaOAuthConfigured: boolean;
  zaloOAuthConfigured: boolean;
  shopifyOAuthConfigured: boolean;
  pendingMetaPages: PendingMetaPages | null;
  initialConnect?: "web";
  suggestedWebHost?: string;
  oauthFlash?: {
    success?: string;
    error?: string;
    errorMessage?: string;
    warning?: string;
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

function CopyRow({
  title,
  hint,
  value,
}: {
  title: string;
  hint?: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-800">{title}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
      <div className="mt-1 flex items-start gap-2 rounded-lg bg-white px-2 py-2 ring-1 ring-border">
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-700">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function PlatformIcon({ channel }: { channel: ChannelAccountView["channel"] }) {
  const platform = CONNECT_PLATFORMS.find((item) => item.channel === channel);
  const accent = platform?.accent ?? CHANNEL_ACCENT[channel];
  const letter = (platform?.name ?? channel).charAt(0).toUpperCase();

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ring-2 ring-white"
      style={{ backgroundColor: accent }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export function SettingsWorkspace({
  channels,
  canConnect,
  canUpdateSettings,
  shopName,
  replyClaimTtlMinutes,
  maxUsersPerShop,
  quickReplies,
  autoReplyRules,
  checklistTemplates,
  metaOAuthConfigured,
  zaloOAuthConfigured,
  shopifyOAuthConfigured,
  pendingMetaPages,
  initialConnect,
  suggestedWebHost,
  oauthFlash,
}: SettingsWorkspaceProps) {
  const [open, setOpen] = useState(
    Boolean(
      initialConnect === "web" ||
        oauthFlash?.pickChannel ||
        oauthFlash?.success ||
        oauthFlash?.error,
    ),
  );
  const [initialPlatformId, setInitialPlatformId] = useState<string | undefined>(
    initialConnect === "web" ? "web" : (oauthFlash?.pickChannel ?? oauthFlash?.success),
  );
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [rotatingWidget, setRotatingWidget] = useState(false);
  const [syncFlash, setSyncFlash] = useState<{ channel: string; ok: boolean; text: string } | null>(
    null,
  );
  const router = useRouter();

  const connectedCount = channels.filter((item) => item.status === "ready").length;

  const flashMessage = useMemo(() => {
    if (oauthFlash?.success) {
      return {
        type: "success" as const,
        title: formatOAuthFlashSuccess(oauthFlash.success),
        hint: oauthFlash.warning ? formatOAuthFlashWarning(oauthFlash.warning) : undefined,
      };
    }
    if (oauthFlash?.error) {
      const view = formatOAuthFlashError(oauthFlash.error, oauthFlash.errorMessage);
      return { type: "error" as const, ...view };
    }
    return null;
  }, [oauthFlash]);

  function openModal(platformId?: string) {
    setInitialPlatformId(platformId);
    setOpen(true);
  }

  async function handleDisconnect(channel: ChannelAccountView["channel"]) {
    if (!canConnect || disconnecting) return;
    const target = channels.find((item) => item.channel === channel);
    const isCancelOAuth = target?.status === "connecting";
    const confirmed = window.confirm(
      isCancelOAuth
        ? "Hủy phiên đang chờ? Bạn có thể kết nối lại sau."
        : channel === "web"
          ? "Ngắt kênh web? Widget trên website sẽ ngừng nhận tin. Hội thoại web ẩn khỏi Inbox đến khi nối lại."
          : "Ngắt kết nối kênh này? Hội thoại kênh này sẽ ẩn khỏi Inbox đến khi nối lại.",
    );
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

  async function handleRotateWidget() {
    if (!canConnect || rotatingWidget) return;
    const confirmed = window.confirm(
      "Tạo widget key mới? Snippet cũ trên website sẽ ngừng nhận tin cho đến khi bạn dán lại.",
    );
    if (!confirmed) return;
    setRotatingWidget(true);
    const result = await rotateWebWidgetKeyAction();
    setRotatingWidget(false);
    setSyncFlash({
      channel: "web",
      ok: Boolean(result.success),
      text: result.success ?? result.error ?? "Không đổi được widget key.",
    });
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header flex shrink-0 flex-wrap items-start justify-between gap-4 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <div>
          <h1 className="page-title">Cài đặt kênh</h1>
          <p className="page-subtitle">
            Nối Facebook, Instagram, Zalo OA, hoặc gắn widget chat lên website.
          </p>
          {channels.length > 0 ? (
            <p className="mt-2 text-xs font-medium text-teal-800">
              {connectedCount}/{channels.length} kênh đã nối
            </p>
          ) : null}
        </div>
        {canConnect ? (
          <button type="button" onClick={() => openModal()} className="btn-primary-sm shrink-0">
            Thêm kết nối
          </button>
        ) : null}
      </header>

      {flashMessage ? (
        <div
          role={flashMessage.type === "error" ? "alert" : "status"}
          className={`shrink-0 border-b px-6 py-3 text-sm ${
            flashMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <p className="font-medium">{flashMessage.title}</p>
          {flashMessage.hint ? (
            <p className="mt-1 text-xs leading-5 text-amber-800/90">{flashMessage.hint}</p>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {canUpdateSettings ? (
          <div className="mx-6 mt-6 space-y-6">
            <ShopPolicyForm
              shopName={shopName}
              replyClaimTtlMinutes={replyClaimTtlMinutes}
              maxUsersPerShop={maxUsersPerShop}
            />
            <QuickReplyManager items={quickReplies} />
            <AutoReplyManager items={autoReplyRules} />
            <OrderChecklistManager items={checklistTemplates} />
          </div>
        ) : null}

        {channels.length === 0 ? (
          <div className="empty-state m-6">
            <NexoMark className="mb-4 h-12 w-12" />
            <p className="text-base font-medium text-slate-700">Chưa có kênh nào</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {canConnect
                ? 'Bấm "Thêm kết nối" để nối Facebook, Instagram, Zalo hoặc widget website.'
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
              <article
                key={channel.id}
                className="card-padded bg-[linear-gradient(165deg,#ffffff_0%,#f0fdfa_100%)]"
              >
                <div className="flex items-start gap-3">
                  <PlatformIcon channel={channel.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold tracking-tight text-teal-950">
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

                    {channel.channel === "web" && channel.status === "ready" && channel.widgetSnippet ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-teal-200/80 bg-white px-3 py-2.5">
                        <CopyRow
                          title="Snippet gắn website"
                          hint="Dán trước thẻ đóng body trên site thật."
                          value={channel.widgetSnippet}
                        />
                        {channel.widgetKey && channel.pageId ? (
                          <WebWidgetExtensionControls
                            widgetKey={channel.widgetKey}
                            websiteHost={channel.pageId}
                          />
                        ) : null}
                        {channel.lastWebhookAt ? (
                          <p className="text-xs font-medium text-emerald-600">
                            Tin widget gần nhất: {formatDateTime(channel.lastWebhookAt)}
                          </p>
                        ) : (
                          <p className="text-xs leading-5 text-amber-700">
                            Chưa có tin từ website. Dán snippet rồi nhắn thử từ đúng domain đã lưu.
                          </p>
                        )}
                        <WebWidgetCheckControls
                          fallbackUrl={channel.pageId}
                          canConnect={canConnect}
                          ready
                        />
                        {canConnect ? (
                          <button
                            type="button"
                            onClick={() => handleRotateWidget()}
                            disabled={rotatingWidget}
                            className="btn-ghost px-2 py-1 text-xs"
                          >
                            {rotatingWidget ? "Đang tạo key..." : "Đổi widget key"}
                          </button>
                        ) : null}
                      </div>
                    ) : channel.lastWebhookAt ? (
                      <p className="mt-1 text-xs font-medium text-emerald-600">
                        Webhook gần nhất: {formatDateTime(channel.lastWebhookAt)}
                      </p>
                    ) : channel.status === "ready" ? (
                      <p className="mt-2 text-xs leading-5 text-amber-700">
                        Đã nối kênh. Inbox sẽ có tin khi khách nhắn vào trang đã kết nối.
                      </p>
                    ) : null}

                    {syncFlash?.channel === channel.channel ? (
                      <p
                        role="status"
                        className={`mt-2 text-xs ${syncFlash.ok ? "text-emerald-600" : "text-amber-700"}`}
                      >
                        {syncFlash.text}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-teal-100/80 pt-4">
                      <button
                        type="button"
                        onClick={() => openModal(channel.channel)}
                        className="btn-secondary"
                      >
                        {channel.status === "ready" ? "Xem kết nối" : "Kết nối kênh"}
                      </button>
                      {canConnect &&
                      metaOAuthConfigured &&
                      channel.status === "ready" &&
                      channel.hasOAuthToken &&
                      (channel.channel === "facebook" || channel.channel === "instagram") ? (
                        <a
                          href={`/api/connect/meta/start?channel=${channel.channel}`}
                          className="btn-secondary"
                        >
                          {oauthSwitchPageLabel(channel.channel)}
                        </a>
                      ) : null}
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
                      {canConnect &&
                      (channel.status === "connecting" ||
                        (channel.status === "ready" && channel.hasOAuthToken) ||
                        (channel.status === "ready" && channel.channel === "web")) ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnect(channel.channel)}
                          disabled={disconnecting === channel.channel}
                          className="btn-ghost text-red-700 hover:bg-red-50"
                        >
                          {disconnecting === channel.channel
                            ? "Đang hủy..."
                            : channel.status === "connecting"
                              ? "Hủy kết nối"
                              : "Ngắt kết nối"}
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
          <div className="mx-6 mb-6 rounded-xl border border-dashed border-teal-200 bg-accent-muted/40 px-4 py-5 text-center">
            <p className="text-sm font-medium text-slate-700">
              Chưa kênh nào ở trạng thái &quot;Đã nối&quot;
            </p>
            <button type="button" onClick={() => openModal()} className="btn-primary-sm mt-3">
              Kết nối kênh đầu tiên
            </button>
          </div>
        ) : null}
      </div>

      {open ? (
        <AddConnectionModal
          channels={channels}
          canConnect={canConnect}
          metaOAuthConfigured={metaOAuthConfigured}
          zaloOAuthConfigured={zaloOAuthConfigured}
          shopifyOAuthConfigured={shopifyOAuthConfigured}
          pendingMetaPages={pendingMetaPages}
          initialPlatformId={initialPlatformId}
          suggestedWebHost={suggestedWebHost}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
