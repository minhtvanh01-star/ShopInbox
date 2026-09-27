"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChannelBadge } from "@/components/ChannelBadge";
import {
  completeMetaPageAction,
  disconnectChannelAction,
  saveChannelCredentialsAction,
  syncMetaChannelAction,
  type CompleteMetaPageState,
  type SaveChannelCredentialsState,
} from "@/app/(app)/settings/actions";
import {
  CONNECT_PLATFORMS,
  PLATFORM_AVAILABILITY_LABEL,
  type PlatformOption,
} from "@/lib/channels";
import { activateFocusTrap, getFocusableElements } from "@/lib/focus-trap";
import {
  CHANNEL_STATUS_LABEL,
  formatDateTime,
  isCurrentMetaPickerPage,
  oauthConnectLabel,
  oauthSwitchPageLabel,
} from "@/lib/labels";
import { LAYOUT_CLASS } from "@/lib/ui-layout";
import type { Channel, ChannelStatus } from "@/lib/types";
import type { MetaPagePickerOption } from "@/lib/oauth-types";
import { OAUTH_ERROR_MESSAGES } from "@/lib/oauth-flash";
import { WebWidgetCheckControls } from "./WebWidgetCheckControls";

export type ChannelAccountView = {
  id: string;
  channel: Channel;
  status: ChannelStatus;
  name: string;
  note: string;
  appId?: string | null;
  /** Đã lưu app secret trên server (không gửi giá trị xuống UI). */
  hasAppSecret?: boolean;
  pageId?: string | null;
  linkedPageId?: string | null;
  hasWebhookSecret?: boolean;
  oaId?: string | null;
  displayName?: string | null;
  expiresAt?: string | null;
  connectedAt?: string | null;
  lastWebhookAt?: string | null;
  hasOAuthToken?: boolean;
  widgetKey?: string | null;
  widgetSnippet?: string | null;
};

type AddConnectionModalProps = {
  channels: ChannelAccountView[];
  canConnect: boolean;
  metaOAuthConfigured: boolean;
  zaloOAuthConfigured: boolean;
  shopifyOAuthConfigured: boolean;
  pendingMetaPages: { channel: Channel; pages: MetaPagePickerOption[] } | null;
  initialPlatformId?: string;
  onClose: () => void;
};

const saveInitialState: SaveChannelCredentialsState = {};
const pickInitialState: CompleteMetaPageState = {};

function PlatformIcon({ platform }: { platform: PlatformOption }) {
  const letter = platform.name.charAt(0).toUpperCase();
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: platform.accent }}
    >
      {letter}
    </span>
  );
}

function secretFieldHasValue(
  account: ChannelAccountView,
  key: "appSecret" | "webhookSecret",
): boolean {
  return key === "appSecret"
    ? Boolean(account.hasAppSecret)
    : Boolean(account.hasWebhookSecret);
}

function oauthStartUrl(platform: PlatformOption) {
  if (platform.channel === "zalo") {
    return "/api/connect/zalo/start";
  }
  if (platform.channel === "facebook" || platform.channel === "instagram") {
    return `/api/connect/meta/start?channel=${platform.channel}`;
  }
  if (platform.channel === "shopify") {
    return "/api/connect/shopify/start";
  }
  return null;
}

function statusBadgeClass(status: ChannelStatus) {
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

function SetupChecklist({
  oauthDone,
  messagesSynced,
  provider,
}: {
  oauthDone: boolean;
  messagesSynced: boolean;
  provider: "meta" | "zalo";
}) {
  const providerLabel = provider === "zalo" ? "Zalo" : "Facebook / Instagram";
  const items = [
    { done: oauthDone, label: `Đã đăng nhập ${providerLabel}` },
    {
      done: messagesSynced,
      label: `Đã nhận tin từ ${providerLabel}`,
    },
  ];

  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-2">
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}
          >
            {item.done ? "✓" : "○"}
          </span>
          <span className={item.done ? "text-slate-700" : "text-slate-500"}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function AddConnectionModal({
  channels,
  canConnect,
  metaOAuthConfigured,
  zaloOAuthConfigured,
  shopifyOAuthConfigured,
  pendingMetaPages,
  initialPlatformId,
  onClose,
}: AddConnectionModalProps) {
  const [selectedId, setSelectedId] = useState(initialPlatformId ?? "facebook");
  const [search, setSearch] = useState("");
  const [shopifyShop, setShopifyShop] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [saveState, saveAction, savePending] = useActionState(
    saveChannelCredentialsAction,
    saveInitialState,
  );
  const [pickState, pickAction, pickPending] = useActionState(
    completeMetaPageAction,
    pickInitialState,
  );

  const selected = CONNECT_PLATFORMS.find((platform) => platform.id === selectedId) ?? CONNECT_PLATFORMS[0];
  const account = selected.channel
    ? channels.find((item) => item.channel === selected.channel)
    : undefined;

  const filteredPlatforms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return CONNECT_PLATFORMS;
    }
    return CONNECT_PLATFORMS.filter(
      (platform) =>
        platform.name.toLowerCase().includes(query) ||
        platform.description.toLowerCase().includes(query),
    );
  }, [search]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = getFocusableElements(dialog);
    const closeBtn = dialog.querySelector<HTMLElement>('[data-modal-close="true"]');
    (focusables[0] ?? closeBtn ?? dialog).focus();

    const releaseTrap = activateFocusTrap(dialog, onClose);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      releaseTrap();
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const connectedPages = channels.filter((item) => item.status === "ready");
  const isOAuthPlatform = Boolean(selected.oauth && selected.channel);
  const oauthConfigured =
    selected.channel === "zalo"
      ? zaloOAuthConfigured
      : selected.channel === "facebook" || selected.channel === "instagram"
        ? metaOAuthConfigured
        : selected.channel === "shopify"
          ? shopifyOAuthConfigured
          : false;
  const shopifyHost = (shopifyShop || account?.pageId || "").trim();
  const oauthUrl =
    selected.channel === "shopify"
      ? shopifyHost
        ? `/api/connect/shopify/start?shop=${encodeURIComponent(shopifyHost)}`
        : null
      : oauthStartUrl(selected);
  const canSwitchMetaPage =
    canConnect &&
    account?.status === "ready" &&
    account.hasOAuthToken &&
    (selected.channel === "facebook" || selected.channel === "instagram");
  const connectLabel =
    canSwitchMetaPage && selected.channel
      ? oauthSwitchPageLabel(selected.channel)
      : oauthConnectLabel(selected.channel);
  const showPagePicker =
    pendingMetaPages &&
    selected.channel &&
    pendingMetaPages.channel === selected.channel &&
    pendingMetaPages.pages.length > 1;

  async function handleDisconnect() {
    if (!account || !canConnect || disconnecting) return;
    const confirmed = window.confirm(
      "Ngắt kết nối kênh này? Hội thoại kênh này sẽ ẩn khỏi Inbox đến khi nối lại.",
    );
    if (!confirmed) return;
    setDisconnecting(true);
    const formData = new FormData();
    formData.set("channel", account.channel);
    await disconnectChannelAction({}, formData);
    setDisconnecting(false);
    router.refresh();
  }

  async function handleSyncMeta() {
    if (!account || !canConnect || syncing) return;
    if (account.channel !== "facebook" && account.channel !== "instagram") return;

    setSyncing(true);
    const formData = new FormData();
    formData.set("channel", account.channel);
    const result = await syncMetaChannelAction({}, formData);
    setSyncing(false);
    setSyncMessage({
      ok: Boolean(result.success),
      text: result.success ?? result.error ?? "Không đồng bộ được.",
    });
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-connection-title"
        tabIndex={-1}
        className="flex h-[min(720px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated outline-none md:flex-row"
      >
        <aside
          className={`flex max-h-44 shrink-0 flex-col border-b border-border bg-surface-muted md:max-h-none md:border-b-0 md:border-r ${LAYOUT_CLASS.modalSidebar}`}
        >
          <div className="border-b border-border px-4 py-4">
            <h2 id="add-connection-title" className="text-base font-semibold text-slate-900">
              Thêm kết nối
            </h2>
              <p className="mt-1 text-xs text-slate-500">Đăng nhập Facebook, Instagram hoặc Zalo</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredPlatforms.map((platform) => {
              const disabled = platform.availability !== "available";
              const active = platform.id === selectedId;
              const badge = PLATFORM_AVAILABILITY_LABEL[platform.availability];

              return (
                <button
                  key={platform.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedId(platform.id)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                    active
                      ? "bg-surface shadow-sm ring-2 ring-teal-200"
                      : disabled
                        ? "cursor-not-allowed opacity-55"
                        : "hover:bg-surface/80"
                  }`}
                >
                  <PlatformIcon platform={platform} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{platform.name}</p>
                      {badge ? (
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-border">
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-500">{platform.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-surface">
          <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Kết nối kênh</h3>
              <p className="mt-1 text-sm text-slate-500">
                Chọn Facebook, Instagram, Zalo hoặc widget website, rồi đăng nhập.
              </p>
            </div>
            <button
              type="button"
              data-modal-close="true"
              onClick={onClose}
              className="icon-btn shrink-0"
              aria-label="Đóng"
            >
              ✕
            </button>
          </header>

          <div className="border-b border-border bg-surface-muted/50 px-6 py-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm trang / kênh..."
              className="input-field-sm max-w-md"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {selected.availability !== "available" ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <PlatformIcon platform={selected} />
                <p className="mt-4 text-base font-semibold text-slate-900">{selected.name}</p>
                <p className="mt-2 max-w-sm text-sm text-slate-500">{selected.description}</p>
                <span className="mt-4 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  {PLATFORM_AVAILABILITY_LABEL[selected.availability] || "Chưa mở"}
                </span>
                {selected.id === "shopify" ? (
                  <div className="mt-4 max-w-sm space-y-3">
                    <p className="text-xs leading-5 text-slate-500">
                      Inbox sẵn trong Shopify (Shopify Inbox) chưa mở — cần app Partner và duyệt.
                      Chat trên theme storefront thì dùng <span className="font-medium">Chat website</span>:
                      lưu domain shop, dán snippet vào theme.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedId("web")}
                      className="btn-primary"
                    >
                      Dùng Chat website
                    </button>
                  </div>
                ) : null}
                {selected.id === "whatsapp" ? (
                  <p className="mt-4 max-w-sm text-xs leading-5 text-slate-500">
                    WhatsApp Cloud API dùng cùng app Meta với Facebook/Instagram. Mở sau khi app Live
                    và Business Verification xong — chưa có nút kết nối.
                  </p>
                ) : null}
                {selected.id === "tiktok" ? (
                  <p className="mt-4 max-w-sm text-xs leading-5 text-slate-500">
                    TikTok Messaging chỉ khi có quyền đối tác API. Giữ Sắp có.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mx-auto max-w-xl">
                {!account ? (
                  <div className="mb-4 rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">
                      Chưa có tài khoản kênh này trong shop.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isOAuthPlatform
                        ? "Bấm nút kết nối bên dưới — hệ thống sẽ tạo kênh tự động."
                        : "Dùng form bên dưới để lưu cấu hình (hoặc liên hệ admin nếu không có quyền)."}
                    </p>
                  </div>
                ) : null}

                {connectedPages.length > 0 ? (
                  <div className="mb-6">
                    <p className="section-label mb-2">Kênh đã nối</p>
                    <ul className="space-y-2">
                      {connectedPages.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm"
                        >
                          <span className="font-medium text-slate-900">
                            {item.displayName ?? item.name}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            {CHANNEL_STATUS_LABEL[item.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {account ? (
                  <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface-muted px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {account.displayName ?? account.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {account.channel === "web"
                          ? account.status === "ready"
                            ? "Widget key đã tạo — dán snippet vào website"
                            : "Điền domain website để bật widget"
                          : account.hasOAuthToken
                            ? "Đã kết nối"
                            : "Chưa kết nối"}
                      </p>
                      {account.connectedAt ? (
                        <p className="mt-1 text-xs text-slate-400">
                          Kết nối lúc {formatDateTime(account.connectedAt)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <ChannelBadge channel={account.channel} />
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass(account.status)}`}
                      >
                        {account.status === "ready" ? "Đã nối" : CHANNEL_STATUS_LABEL[account.status]}
                      </span>
                    </div>
                  </div>
                ) : null}

                {account?.status === "ready" && account.channel === "web" && account.widgetSnippet ? (
                  <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                    <p className="section-label mb-3">Snippet widget</p>
                    <div className="flex items-start gap-2 rounded-lg bg-white px-2 py-2 ring-1 ring-border">
                      <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-700">
                        {account.widgetSnippet}
                      </code>
                      <CopyButton value={account.widgetSnippet} />
                    </div>
                    {account.lastWebhookAt ? (
                      <p className="mt-3 text-xs text-emerald-600">
                        Tin widget gần nhất: {formatDateTime(account.lastWebhookAt)}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-amber-700">
                        Dán snippet trước thẻ đóng body trên đúng domain đã lưu, rồi nhắn thử.
                      </p>
                    )}
                  </div>
                ) : account?.status === "ready" && isOAuthPlatform ? (
                  <div className="mb-4 rounded-xl border border-border bg-surface-muted/60 p-4">
                    <p className="section-label mb-3">Tiến độ thiết lập</p>
                    <SetupChecklist
                      oauthDone={Boolean(account.hasOAuthToken)}
                      messagesSynced={Boolean(account.lastWebhookAt)}
                      provider={selected.channel === "zalo" ? "zalo" : "meta"}
                    />
                    {account.lastWebhookAt ? (
                      <p className="mt-3 text-xs text-emerald-600">
                        Tin nhắn gần nhất: {formatDateTime(account.lastWebhookAt)}
                      </p>
                    ) : account.hasOAuthToken ? (
                      <p className="mt-3 text-xs text-amber-700">
                        Đã nối kênh. Inbox sẽ có tin khi khách nhắn vào trang này.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!canConnect ? (
                  <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                    Bạn không có quyền kết nối kênh.
                  </p>
                ) : null}

                {showPagePicker && pendingMetaPages ? (
                  <form action={pickAction} className="mt-4 space-y-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {canSwitchMetaPage ? "Đổi trang đang dùng cho Inbox" : "Chọn trang để kích hoạt"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Tài khoản Meta có nhiều Fanpage. Mỗi shop chỉ dùng một trang cho kênh{" "}
                        {pendingMetaPages.channel === "instagram" ? "Instagram" : "Facebook"}.
                        {canSwitchMetaPage
                          ? " Chọn trang khác rồi xác nhận — hội thoại trang cũ vẫn xem được."
                          : ""}
                      </p>
                    </div>
                    <fieldset className="space-y-2">
                      {pendingMetaPages.pages.map((page) => {
                        const label =
                          pendingMetaPages.channel === "instagram" && page.instagramUsername
                            ? `@${page.instagramUsername} (${page.pageName})`
                            : page.pageName;
                        const disabled =
                          pendingMetaPages.channel === "instagram" && !page.instagramId;
                        const current = isCurrentMetaPickerPage(
                          pendingMetaPages.channel,
                          page,
                          account,
                        );
                        return (
                          <label
                            key={page.pageId}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm ${
                              disabled ? "cursor-not-allowed opacity-50" : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name="pageId"
                              value={page.pageId}
                              required
                              defaultChecked={current}
                              disabled={disabled || !canConnect}
                              className="text-teal-600"
                            />
                            <span>{label}</span>
                            {current ? (
                              <span className="text-xs font-medium text-teal-700">Đang dùng</span>
                            ) : null}
                            {disabled ? (
                              <span className="text-xs text-slate-400">(chưa có IG Business)</span>
                            ) : null}
                          </label>
                        );
                      })}
                    </fieldset>
                    {pickState.error ? (
                      <p role="alert" className="alert-error">
                        {pickState.error}
                      </p>
                    ) : null}
                    {pickState.success ? <p className="alert-success">{pickState.success}</p> : null}
                    <button type="submit" disabled={!canConnect || pickPending} className="btn-primary">
                      {pickPending
                        ? "Đang lưu..."
                        : canSwitchMetaPage
                          ? "Đổi sang trang này"
                          : "Xác nhận trang"}
                    </button>
                  </form>
                ) : null}

                {isOAuthPlatform ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        {canSwitchMetaPage ? "Đổi Fanpage / trang" : "Kết nối kênh"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selected.channel === "zalo"
                          ? "Đăng nhập Zalo OA và cấp quyền cho ShopInbox."
                          : selected.channel === "shopify"
                            ? "Nhập domain *.myshopify.com rồi đăng nhập admin Shopify để cấp quyền."
                            : canSwitchMetaPage
                              ? "Tài khoản Facebook có nhiều Fanpage? Đăng nhập lại (admin trang), rồi chọn trang khác. Mỗi shop chỉ dùng một trang cùng lúc."
                              : "Đăng nhập Facebook với tài khoản admin Fanpage / Instagram Business, rồi chọn trang cho Inbox."}
                      </p>
                      {selected.channel === "shopify" ? (
                        <label className="mt-3 block">
                          <span className="label">Domain Shopify</span>
                          <input
                            type="text"
                            value={shopifyShop || account?.pageId || ""}
                            onChange={(event) => setShopifyShop(event.target.value)}
                            placeholder="cuahang.myshopify.com"
                            disabled={!canConnect || account?.status === "ready"}
                            className="input-field-sm disabled:bg-surface-muted"
                          />
                        </label>
                      ) : null}
                      {canConnect && oauthConfigured && oauthUrl ? (
                        <a href={oauthUrl} className="btn-primary mt-3 inline-flex">
                          {connectLabel}
                        </a>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <button
                            type="button"
                            disabled
                            className="btn-primary inline-flex cursor-not-allowed opacity-50"
                          >
                            {connectLabel}
                          </button>
                          {canConnect ? (
                            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
                              Kết nối kênh này chưa sẵn sàng trên hệ thống. Liên hệ quản trị.
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {(selected.channel === "facebook" || selected.channel === "instagram") &&
                    account?.status === "ready" &&
                    account.hasOAuthToken ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handleSyncMeta}
                          disabled={!canConnect || syncing}
                          className="btn-secondary"
                        >
                          {syncing ? "Đang đồng bộ..." : "Đồng bộ tin nhắn gần đây"}
                        </button>
                        {syncMessage ? (
                          <p
                            className={`text-xs ${syncMessage.ok ? "text-emerald-600" : "text-amber-700"}`}
                          >
                            {syncMessage.text}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {canConnect &&
                    account?.status === "ready" &&
                    (account.hasOAuthToken || account.channel === "web") ? (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="text-sm font-medium text-red-700 hover:text-red-900"
                      >
                        {disconnecting ? "Đang ngắt kết nối..." : "Ngắt kết nối kênh"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {selected.fields.length > 0 && selected.channel === "web" ? (
                  <form action={saveAction} className="mt-4 space-y-4">
                    <input type="hidden" name="channel" value={account?.channel ?? selected.channel} />

                    <ol className="list-decimal space-y-1 pl-4 text-xs leading-5 text-slate-500">
                      <li>Dán link website (đúng domain sẽ gắn chat).</li>
                      <li>Bấm Kiểm tra website — xem HTML đã có widget / chat khác chưa.</li>
                      <li>Lưu &amp; kết nối để lấy snippet, dán trước thẻ đóng body.</li>
                      <li>Kiểm tra lại, hoặc Thử chat tại đây / Inbox kênh Web.</li>
                    </ol>

                    {selected.fields.map((field) => {
                      const formChannel = account?.channel ?? selected.channel;
                      const isSecret = field.key === "appSecret" || field.key === "webhookSecret";
                      const hasSecret = Boolean(
                        isSecret &&
                          account &&
                          secretFieldHasValue(account, field.key as "appSecret" | "webhookSecret"),
                      );
                      const existingNonSecret = isSecret
                        ? ""
                        : ((account?.[field.key as "appId" | "pageId" | "oaId"] as
                            | string
                            | null
                            | undefined) ?? "");
                      return (
                        <div key={field.key}>
                          <label htmlFor={`${formChannel}-${field.key}`} className="label">
                            {field.label}
                            {field.required ? " *" : ""}
                          </label>
                          <input
                            id={`${formChannel}-${field.key}`}
                            name={field.key}
                            type={isSecret ? "password" : "text"}
                            autoComplete="off"
                            placeholder={
                              hasSecret
                                ? "•••••••• (đã lưu — để trống nếu giữ)"
                                : field.placeholder
                            }
                            defaultValue={isSecret ? "" : existingNonSecret}
                            disabled={!canConnect}
                            className="input-field-sm disabled:bg-surface-muted"
                          />
                          {hasSecret ? (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Secret không hiện lại trên UI. Để trống nếu giữ giá trị đã lưu.
                            </p>
                          ) : null}
                        </div>
                      );
                    })}

                    {selected.channel === "web" ? (
                      <WebWidgetCheckControls
                        urlInputId={`${account?.channel ?? selected.channel}-pageId`}
                        fallbackUrl={account?.pageId}
                        canConnect={canConnect}
                        ready={account?.status === "ready"}
                      />
                    ) : null}

                    <div>
                      <label htmlFor={`${account?.channel ?? selected.channel}-note`} className="label">
                        Ghi chú trạng thái
                      </label>
                      <textarea
                        id={`${account?.channel ?? selected.channel}-note`}
                        name="note"
                        rows={2}
                        defaultValue={account?.note ?? ""}
                        disabled={!canConnect}
                        placeholder={
                          selected.channel === "web"
                            ? "VD: Widget gắn footer cuahang.vn"
                            : "VD: Đã tạo app Meta, chờ duyệt quyền pages_messaging"
                        }
                        className="textarea-field disabled:bg-surface-muted"
                      />
                    </div>

                    {saveState.error ? (
                      <p role="alert" className="alert-error">
                        {saveState.error}
                      </p>
                    ) : null}
                    {saveState.success ? <p className="alert-success">{saveState.success}</p> : null}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button type="submit" disabled={!canConnect || savePending} className="btn-secondary">
                        {savePending
                          ? "Đang lưu..."
                          : selected.channel === "web"
                            ? "Lưu & kết nối"
                            : "Lưu cấu hình thủ công"}
                      </button>
                      <button type="button" onClick={onClose} className="btn-ghost">
                        Đóng
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary">
                      Đóng
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export { OAUTH_ERROR_MESSAGES };
