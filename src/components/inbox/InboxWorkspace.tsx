"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  claimConversation,
  markConversationRead,
  releaseConversation,
  sendMessage,
  touchConversationClaim,
  updateConversationTag,
} from "@/app/(app)/actions";
import {
  formatReplyClaimCountdown,
  replyClaimRemainingMs,
  REPLY_CLAIM_TTL_MINUTES,
} from "@/backend/reply-claim";
import { ChannelBadge } from "@/components/ChannelBadge";
import { CreateOrderForm } from "@/components/inbox/CreateOrderForm";
import {
  CHANNEL_LABEL,
  TAG_LABEL,
  formatMoney,
  formatTime,
  getInboxChannelFilters,
  inboxChannelsSubtitle,
  orderTotal,
} from "@/lib/labels";
import { LAYOUT_CLASS, STORAGE_KEYS } from "@/lib/ui-layout";
import { usePersistedState } from "@/lib/use-persisted-state";
import type {
  Channel,
  Conversation,
  ConversationTag,
  Customer,
  Message,
  Order,
  Product,
  QuickReply,
} from "@/lib/types";

type MobilePane = "list" | "chat" | "customer";

type InboxWorkspaceProps = {
  conversations: Conversation[];
  messages: Message[];
  customers: Customer[];
  orders: Order[];
  products: Product[];
  quickReplies: QuickReply[];
  currentStaffId: string;
  currentStaffName: string;
  /** Kênh đã nối / có hội thoại — để hiện pill từ cấu hình, không hardcode. */
  activeChannels?: Channel[];
  initialConversationId?: string;
};

type ConversationPatch = {
  id: string;
  lastMessage?: string;
  lastAt?: string;
  unread?: number;
  tag?: ConversationTag;
  replyStaffId?: string | null;
  replyStaffName?: string | null;
  replyClaimedAt?: string | null;
};

const MOBILE_TABS: Array<{ id: MobilePane; label: string }> = [
  { id: "list", label: "Hội thoại" },
  { id: "chat", label: "Chat" },
  { id: "customer", label: "Khách" },
];

const TAG_OPTIONS = Object.keys(TAG_LABEL) as ConversationTag[];
/** Tối thiểu giữa 2 lần gia hạn khi đang gõ. */
const CLAIM_TOUCH_MIN_INTERVAL_MS = 45_000;
/** Heartbeat khi tab còn mở / đang giữ hội thoại — tránh out dù không gõ liên tục. */
const CLAIM_HEARTBEAT_MS = 2 * 60 * 1000;
const INBOX_SOFT_REFRESH_MS = 20_000;

export function InboxWorkspace({
  conversations,
  messages,
  customers,
  orders,
  products,
  quickReplies,
  currentStaffId,
  currentStaffName,
  activeChannels,
  initialConversationId,
}: InboxWorkspaceProps) {
  const router = useRouter();
  const channelFilters = useMemo(
    () => getInboxChannelFilters(activeChannels),
    [activeChannels],
  );
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [selectedId, setSelectedId] = useState(
    initialConversationId || conversations[0]?.id || "",
  );
  const [draft, setDraft] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>(
    initialConversationId ? "chat" : "list",
  );
  const [customerPanelOpen, setCustomerPanelOpen] = usePersistedState(
    STORAGE_KEYS.inboxCustomerPanel,
    true,
  );
  const [isPending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [stickToBottom, setStickToBottom] = useState(true);
  const lastClaimTouchRef = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [trackedSelectedId, setTrackedSelectedId] = useState(selectedId);
  const [trackedThreadKey, setTrackedThreadKey] = useState(
    `${initialConversationId || conversations[0]?.id || ""}:0`,
  );
  const [prevInitialConversationId, setPrevInitialConversationId] = useState(initialConversationId);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (current, message: Message) => [...current, message],
  );
  const [optimisticConversations, patchOptimisticConversation] = useOptimistic(
    conversations,
    (current, patch: ConversationPatch) =>
      current.map((item) =>
        item.id === patch.id
          ? {
              ...item,
              ...(patch.lastMessage !== undefined ? { lastMessage: patch.lastMessage } : {}),
              ...(patch.lastAt !== undefined ? { lastAt: patch.lastAt } : {}),
              ...(patch.unread !== undefined ? { unread: patch.unread } : {}),
              ...(patch.tag !== undefined ? { tag: patch.tag } : {}),
              ...(patch.replyStaffId !== undefined ? { replyStaffId: patch.replyStaffId } : {}),
              ...(patch.replyStaffName !== undefined
                ? { replyStaffName: patch.replyStaffName }
                : {}),
              ...(patch.replyClaimedAt !== undefined
                ? { replyClaimedAt: patch.replyClaimedAt }
                : {}),
            }
          : item,
      ),
  );

  const customerById = useMemo(() => {
    const map = new Map(customers.map((item) => [item.id, item]));
    return (id: string) => map.get(id);
  }, [customers]);

  // Nếu kênh đang chọn biến mất khỏi bộ lọc (ngắt kết nối), về "Tất cả"
  const selectedFilter =
    channelFilters.some((item) => item.id === channel) ? channel : "all";

  const visible = useMemo(
    () =>
      optimisticConversations
        .filter((item) => selectedFilter === "all" || item.channel === selectedFilter)
        .sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt)),
    [selectedFilter, optimisticConversations],
  );

  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const customer = selected ? customerById(selected.customerId) : undefined;
  const thread = selected
    ? optimisticMessages.filter((item) => item.conversationId === selected.id)
    : [];
  const customerOrders = customer
    ? orders.filter((item) => item.customerId === customer.id)
    : [];

  const claimRemainingMs = selected?.replyClaimedAt
    ? replyClaimRemainingMs(selected.replyClaimedAt, nowMs)
    : 0;
  const claimActive = Boolean(selected?.replyStaffId) && claimRemainingMs > 0;
  const replyLockedByOther = Boolean(
    claimActive && selected?.replyStaffId && selected.replyStaffId !== currentStaffId,
  );
  const replyIsMine = Boolean(
    claimActive && selected?.replyStaffId && selected.replyStaffId === currentStaffId,
  );
  const canCompose = replyIsMine && !isPending;
  const claimCountdown = claimActive ? formatReplyClaimCountdown(claimRemainingMs) : null;

  if (initialConversationId && initialConversationId !== prevInitialConversationId) {
    setPrevInitialConversationId(initialConversationId);
    setSelectedId(initialConversationId);
    setMobilePane("chat");
  }

  if (selectedId !== trackedSelectedId) {
    setTrackedSelectedId(selectedId);
    setPendingNewCount(0);
    setStickToBottom(true);
    setTrackedThreadKey(`${selected?.id ?? ""}:${thread.length}`);
  } else {
    const threadKey = `${selected?.id ?? ""}:${thread.length}`;
    if (threadKey !== trackedThreadKey) {
      const [, prevLenRaw] = trackedThreadKey.split(":");
      const prevLen = Number(prevLenRaw) || 0;
      setTrackedThreadKey(threadKey);
      if (thread.length > prevLen) {
        const delta = thread.length - prevLen;
        if (stickToBottom) {
          setPendingNewCount(0);
        } else {
          setPendingNewCount((count) => count + delta);
        }
      }
    }
  }

  useEffect(() => {
    if (!stickToBottom || pendingNewCount > 0) {
      return;
    }
    const node = threadRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [thread.length, selected?.id, pendingNewCount, stickToBottom]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const timer = window.setInterval(refresh, INBOX_SOFT_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  useEffect(() => {
    const hasClaimFields = optimisticConversations.some(
      (item) => Boolean(item.replyStaffId && item.replyClaimedAt),
    );
    if (!hasClaimFields) {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [optimisticConversations]);

  useEffect(() => {
    if (!selected?.replyStaffId || !selected.replyClaimedAt) {
      return;
    }
    if (claimRemainingMs > 0) {
      return;
    }
    const id = selected.id;
    const wasMine = selected.replyStaffId === currentStaffId;
    startTransition(() => {
      patchOptimisticConversation({
        id,
        replyStaffId: null,
        replyStaffName: null,
        replyClaimedAt: null,
      });
    });
    if (wasMine) {
      void releaseConversation(id).catch(() => {
        // Hết hạn phía client — DB có thể đã hết hạn theo TTL.
      });
    }
  }, [
    claimRemainingMs,
    selected?.id,
    selected?.replyStaffId,
    selected?.replyClaimedAt,
    currentStaffId,
    patchOptimisticConversation,
    startTransition,
  ]);

  useEffect(() => {
    const id = selected?.id;
    const unread = selected?.unread ?? 0;
    if (!id || unread <= 0) {
      return;
    }
    startTransition(() => {
      patchOptimisticConversation({ id, unread: 0 });
    });
    void markConversationRead(id).catch((err) => {
      setError(err instanceof Error ? err.message : "Không đánh dấu đã đọc được");
    });
  }, [selected?.id, selected?.unread, patchOptimisticConversation, startTransition]);

  function renewClaimActivity(conversationId: string, options?: { force?: boolean; atMs?: number }) {
    const at = options?.atMs ?? nowMs;
    if (!options?.force && at - lastClaimTouchRef.current < CLAIM_TOUCH_MIN_INTERVAL_MS) {
      return;
    }
    lastClaimTouchRef.current = at;
    const claimedAt = new Date(at).toISOString();
    startTransition(() => {
      patchOptimisticConversation({
        id: conversationId,
        replyStaffId: currentStaffId,
        replyStaffName: currentStaffName,
        replyClaimedAt: claimedAt,
      });
    });
    void touchConversationClaim(conversationId)
      .then((result) => {
        startTransition(() => {
          patchOptimisticConversation({
            id: conversationId,
            replyClaimedAt: result.claimedAt,
          });
        });
        setNowMs(Date.now());
      })
      .catch(() => {
        // Bỏ qua — lần gửi tin / claim kế tiếp sẽ đồng bộ lại.
      });
  }

  useEffect(() => {
    if (!replyIsMine || !selected?.id) {
      return;
    }
    const conversationId = selected.id;

    const beat = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const at = Date.now();
      setNowMs(at);
      renewClaimActivity(conversationId, { force: true, atMs: at });
    };

    const timer = window.setInterval(beat, CLAIM_HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        beat();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Heartbeat chỉ theo hội thoại đang giữ; renew dùng staff hiện tại.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [replyIsMine, selected?.id, currentStaffId, currentStaffName]);

  function selectConversation(id: string) {
    setSelectedId(id);
    setCreatingOrder(false);
    setMobilePane("chat");
    setError(null);
  }

  function changeTag(tag: ConversationTag) {
    if (!selected || selected.tag === tag || isPending) return;

    startTransition(async () => {
      patchOptimisticConversation({ id: selected.id, tag });
      try {
        await updateConversationTag(selected.id, tag);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Đổi nhãn thất bại");
      }
    });
  }

  function claimReply() {
    if (!selected || isPending || replyLockedByOther) return;
    const claimedAt = new Date(nowMs).toISOString();
    startTransition(async () => {
      patchOptimisticConversation({
        id: selected.id,
        replyStaffId: currentStaffId,
        replyStaffName: currentStaffName,
        replyClaimedAt: claimedAt,
      });
      try {
        const result = await claimConversation(selected.id);
        lastClaimTouchRef.current = nowMs;
        patchOptimisticConversation({
          id: selected.id,
          replyClaimedAt: result.claimedAt,
        });
        queueMicrotask(() => composerRef.current?.focus());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không nhận được hội thoại");
      }
    });
  }

  function releaseReply() {
    if (!selected || isPending || !replyIsMine) return;
    startTransition(async () => {
      patchOptimisticConversation({
        id: selected.id,
        replyStaffId: null,
        replyStaffName: null,
        replyClaimedAt: null,
      });
      try {
        await releaseConversation(selected.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không nhả được hội thoại");
      }
    });
  }

  function onDraftChange(value: string) {
    setDraft(value);
    if (!selected || !replyIsMine || !value.trim()) {
      return;
    }
    renewClaimActivity(selected.id);
  }

  function send(text: string) {
    if (!selected || !text.trim() || isPending || !replyIsMine) return;

    const body = text.trim();
    const tempId = `temp-${crypto.randomUUID()}`;
    const sentAt = new Date(nowMs).toISOString();
    const optimistic: Message = {
      id: tempId,
      conversationId: selected.id,
      sender: "shop",
      text: body,
      createdAt: sentAt,
    };

    setError(null);
    setDraft("");
    lastClaimTouchRef.current = nowMs;

    startTransition(async () => {
      addOptimisticMessage(optimistic);
      patchOptimisticConversation({
        id: selected.id,
        lastMessage: body,
        lastAt: sentAt,
        unread: 0,
        replyStaffId: currentStaffId,
        replyStaffName: currentStaffName,
        replyClaimedAt: sentAt,
      });

      try {
        await sendMessage(selected.id, body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gửi tin thất bại");
      }
    });
  }

  const showList = mobilePane === "list";
  const showChat = mobilePane === "chat";
  const showCustomer = mobilePane === "customer";

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section
        className={`flex flex-col border-border-strong bg-surface transition-opacity duration-150 lg:border-r ${
          LAYOUT_CLASS.inboxList
        } ${showList ? "flex min-h-0 flex-1 lg:flex-none" : "hidden lg:flex"}`}
      >
        <div className="border-b border-border px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Inbox</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {inboxChannelsSubtitle(channelFilters)}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {channelFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setChannel(item.id)}
                className={`filter-pill ${
                  selectedFilter === item.id ? "filter-pill-active" : "filter-pill-inactive"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Không có hội thoại phù hợp bộ lọc
            </li>
          ) : null}
          {visible.map((item) => {
            const person = customerById(item.customerId);
            const active = selected?.id === item.id;
            const itemClaimActive =
              Boolean(item.replyStaffId) &&
              replyClaimRemainingMs(item.replyClaimedAt, nowMs) > 0;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => selectConversation(item.id)}
                  className={`flex w-full flex-col gap-1.5 border-b border-border px-4 py-3.5 text-left transition-colors duration-150 ${
                    active
                      ? "border-l-[3px] border-l-teal-500 bg-accent-muted"
                      : "border-l-[3px] border-l-transparent hover:bg-surface-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {person?.name ?? "Khách"}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatTime(item.lastAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChannelBadge channel={item.channel} />
                    <span className="text-[11px] text-slate-500">{TAG_LABEL[item.tag]}</span>
                    {itemClaimActive ? (
                      <>
                        <span
                          className={`activity-dot ${
                            item.replyStaffId === currentStaffId
                              ? "activity-dot-mine"
                              : "activity-dot-other"
                          }`}
                          title={
                            item.replyStaffId === currentStaffId
                              ? "Bạn đang trả lời"
                              : `${item.replyStaffName ?? "Nhân viên"} đang trả lời`
                          }
                          aria-label="Đang hoạt động"
                        />
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            item.replyStaffId === currentStaffId
                              ? "bg-teal-50 text-teal-700"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {item.replyStaffId === currentStaffId
                            ? "Bạn đang trả lời"
                            : item.replyStaffName ?? "Đang trả lời"}
                        </span>
                      </>
                    ) : null}
                    {item.unread > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[10px] font-bold text-white">
                        {item.unread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{item.lastMessage}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className={`flex min-w-0 flex-col bg-surface-muted ${
          showChat ? "min-h-0 flex-1" : "hidden lg:flex lg:min-h-0 lg:flex-1"
        }`}
      >
        {selected && customer ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {claimActive ? (
                    <span
                      className={`activity-dot ${replyIsMine ? "activity-dot-mine" : "activity-dot-other"}`}
                      aria-label={replyIsMine ? "Bạn đang trả lời" : "Đang có người trả lời"}
                    />
                  ) : null}
                  <p className="truncate text-base font-semibold text-slate-900">{customer.name}</p>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">{CHANNEL_LABEL[selected.channel]}</span>
                  <label className="inline-flex items-center gap-1.5">
                    <span className="sr-only">Nhãn hội thoại</span>
                    <select
                      value={selected.tag}
                      disabled={isPending}
                      onChange={(event) => changeTag(event.target.value as ConversationTag)}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-teal-500"
                    >
                      {TAG_OPTIONS.map((tag) => (
                        <option key={tag} value={tag}>
                          {TAG_LABEL[tag]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!claimActive ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={claimReply}
                    className="btn-primary-sm"
                  >
                    Tôi trả lời
                  </button>
                ) : replyIsMine ? (
                  <div className="flex items-center gap-2">
                    {claimCountdown ? (
                      <span className="text-[11px] tabular-nums text-slate-500" title="Hết hạn nếu không dùng">
                        Còn {claimCountdown}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={releaseReply}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-surface-muted disabled:opacity-50"
                    >
                      Nhả hội thoại
                    </button>
                  </div>
                ) : (
                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                    {selected.replyStaffName ?? "Nhân viên khác"} đang trả lời
                    {claimCountdown ? ` · ${claimCountdown}` : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCustomerPanelOpen((open) => !open);
                    setMobilePane("customer");
                  }}
                  className="icon-btn hidden lg:inline-flex"
                  aria-label={customerPanelOpen ? "Ẩn panel khách hàng" : "Hiện panel khách hàng"}
                  title={customerPanelOpen ? "Ẩn khách hàng" : "Hiện khách hàng"}
                >
                  <PanelIcon open={customerPanelOpen} />
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePane("customer")}
                  className="icon-btn lg:hidden"
                  aria-label="Xem khách hàng"
                >
                  <UserIcon />
                </button>
              </div>
            </header>
            <div
              ref={threadRef}
              onScroll={(event) => {
                const node = event.currentTarget;
                const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
                const atBottom = distance < 72;
                setStickToBottom(atBottom);
                if (atBottom && pendingNewCount > 0) {
                  setPendingNewCount(0);
                }
              }}
              className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5"
            >
              {pendingNewCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const node = threadRef.current;
                    if (node) {
                      node.scrollTop = node.scrollHeight;
                    }
                    setStickToBottom(true);
                    setPendingNewCount(0);
                  }}
                  className="sticky top-0 z-10 mx-auto mb-2 block rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 shadow-sm"
                >
                  {pendingNewCount} tin mới — xem ngay
                </button>
              ) : null}
              {thread.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${item.sender === "shop" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[var(--chat-bubble-max)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-colors duration-150 ${
                      item.sender === "shop"
                        ? "rounded-br-md bg-teal-600 text-white"
                        : "rounded-bl-md border border-border bg-surface text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{item.text}</p>
                    <p
                      className={`mt-1.5 text-[10px] ${
                        item.sender === "shop" ? "text-teal-100" : "text-slate-400"
                      }`}
                    >
                      {formatTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <footer className="border-t border-border bg-surface p-3 sm:p-4">
              {error ? <p className="alert-error mb-2 text-xs">{error}</p> : null}
              {replyLockedByOther ? (
                <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span className="activity-dot activity-dot-other" aria-hidden />
                  <span>
                    {selected.replyStaffName ?? "Nhân viên khác"} đang trả lời
                    {claimCountdown ? ` (còn ${claimCountdown})` : ""} — bạn không gửi được cho đến khi
                    họ nhả hoặc hết thời gian không dùng.
                  </span>
                </p>
              ) : replyIsMine ? (
                <p className="mb-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                  <span className="activity-dot activity-dot-mine" aria-hidden />
                  <span>
                    Bạn đang trả lời
                    {claimCountdown
                      ? ` · tự nhả sau ${claimCountdown} nếu không hoạt động (${REPLY_CLAIM_TTL_MINUTES} phút)`
                      : ""}
                    .
                  </span>
                </p>
              ) : (
                <p className="mb-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-slate-600">
                  Bấm <strong>Tôi trả lời</strong> để nhận hội thoại trước khi gửi tin.
                </p>
              )}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {quickReplies.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!canCompose}
                    onClick={() => send(item.text)}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:border-teal-200 hover:bg-accent-muted hover:text-teal-800 disabled:opacity-50"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  send(draft);
                }}
              >
                <textarea
                  ref={composerRef}
                  value={draft}
                  rows={2}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send(draft);
                    }
                  }}
                  placeholder={
                    replyIsMine
                      ? "Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
                      : replyLockedByOther
                        ? "Đang bị khóa..."
                        : "Nhận hội thoại để trả lời..."
                  }
                  disabled={!canCompose}
                  className="input-field-sm min-h-11 flex-1 resize-none py-2.5"
                />
                <button type="submit" disabled={!canCompose} className="btn-primary-sm shrink-0">
                  Gửi
                </button>
              </form>
            </footer>
          </>
        ) : (
          <div className="empty-state m-4 flex-1 sm:m-6">
            <p className="text-base font-medium text-slate-700">Chọn một hội thoại</p>
            <p className="mt-1 text-sm text-slate-500">
              Danh sách bên trái — chi tiết khách bên phải
            </p>
          </div>
        )}
      </section>

      <aside
        className={`flex flex-col border-border-strong bg-surface transition-[width,opacity] duration-200 lg:border-l ${
          LAYOUT_CLASS.inboxPanel
        } ${
          customerPanelOpen
            ? showCustomer
              ? "min-h-0 flex-1 lg:flex-none"
              : "hidden lg:flex"
            : "hidden"
        }`}
      >
        {customer ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="section-label">Khách hàng</p>
              <button
                type="button"
                onClick={() => setCustomerPanelOpen(false)}
                className="icon-btn -mr-1 -mt-1 lg:hidden"
                aria-label="Đóng panel khách"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-900">{customer.name}</p>
            <p className="mt-1 text-sm text-slate-600">{customer.phone ?? "Chưa có SĐT"}</p>
            {customer.note ? (
              <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2.5 text-sm leading-6 text-slate-600">
                {customer.note}
              </p>
            ) : null}
            {creatingOrder && selected ? (
              <CreateOrderForm
                conversationId={selected.id}
                customerName={customer.name}
                defaultPhone={customer.phone}
                defaultAddress={customer.address}
                products={products}
                onClose={() => setCreatingOrder(false)}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCreatingOrder(true)}
                  className="btn-primary mt-5 w-full"
                >
                  Tạo đơn
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Lưu đơn vào PostgreSQL, gắn với hội thoại này
                </p>
              </>
            )}
            <div className="mt-6 border-t border-border pt-5">
              <p className="section-label">Đơn gần đây</p>
              <div className="mt-3 space-y-2">
                {customerOrders.length === 0 && (
                  <p className="text-sm text-slate-500">Chưa có đơn</p>
                )}
                {customerOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 transition-colors duration-150 hover:bg-surface"
                  >
                    <p className="text-sm font-semibold text-slate-800">{order.code}</p>
                    <p className="text-xs text-slate-500">{formatMoney(orderTotal(order.items))}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-5 text-center text-sm text-slate-400">
            Chọn hội thoại để xem thông tin khách
          </div>
        )}
      </aside>

      <nav className="flex shrink-0 border-t border-border bg-surface lg:hidden">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePane(tab.id)}
            className={`nav-tab ${mobilePane === tab.id ? "nav-tab-active" : "nav-tab-inactive"}`}
          >
            <MobileTabIcon pane={tab.id} active={mobilePane === tab.id} />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function PanelIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {open ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M15 3v18" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </>
      )}
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function MobileTabIcon({ pane, active }: { pane: MobilePane; active: boolean }) {
  const color = active ? "text-teal-600" : "text-slate-400";
  if (pane === "list") {
    return (
      <svg className={color} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    );
  }
  if (pane === "chat") {
    return (
      <svg className={color} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  return (
    <svg className={color} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
