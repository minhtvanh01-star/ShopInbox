"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  claimConversation,
  getConversationReceipts,
  markConversationRead,
  mergeCustomerOpenOrdersAction,
  reactToMessage,
  releaseConversation,
  sendImageMessage,
  sendMessage,
  touchConversationClaim,
  updateConversationTag,
} from "@/app/(app)/actions";
import {
  formatReplyClaimCountdown,
  makeClaimOverride,
  reconcileClaimOverride,
  replyClaimRemainingMs,
  REPLY_CLAIM_TTL_MS,
  type ClaimOverride,
} from "@/backend/reply-claim";
import { replyClaimTtlMs, DEFAULT_REPLY_CLAIM_TTL_MINUTES } from "@/lib/shop-policy";
import { ChannelBadge } from "@/components/ChannelBadge";
import { CreateOrderForm } from "@/components/inbox/CreateOrderForm";
import { CustomerAvatar } from "@/components/inbox/CustomerAvatar";
import { CustomerProfileForm } from "@/components/inbox/CustomerProfileForm";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import {
  COMPOSER_LIKE_EMOJI,
  EmojiPickerButton,
  ImagePickerButton,
  LikeSendButton,
} from "@/components/inbox/MessageComposerTools";
import {
  chatDayKey,
  mergeConversationThread,
  pruneSyncedOutbound,
  type LocalOutboundMessage,
} from "@/lib/inbox-thread";
import {
  applyMessageReceipts,
  mergeReceiptOverlay,
  type MessageReceiptPatch,
} from "@/lib/message-receipt";
import {
  CHANNEL_LABEL,
  TAG_LABEL,
  ORDER_STATUS_LABEL,
  formatChatDayLabel,
  formatMoney,
  formatTime,
  getInboxChannelFilters,
  inboxChannelsSubtitle,
  orderTotal,
} from "@/lib/labels";
import {
  INBOX_LIST_COLLAPSED,
  INBOX_LIST_DEFAULT,
  INBOX_LIST_MAX,
  INBOX_LIST_MIN,
  LAYOUT_CLASS,
  STORAGE_KEYS,
  clampInboxListWidth,
} from "@/lib/ui-layout";
import { notifyInboxNoticesRefresh } from "@/lib/inbox-notices";
import { MESSAGE_TEXT_MAX } from "@/lib/inbox-media";
import {
  getMessagingWindowInfo,
  latestCustomerMessageAt,
} from "@/lib/messaging-window";
import { usePersistedState } from "@/lib/use-persisted-state";
import type {
  Channel,
  Conversation,
  ConversationTag,
  Customer,
  Message,
  Order,
  SellableVariant,
  QuickReply,
} from "@/lib/types";

type MobilePane = "list" | "chat" | "customer";

type InboxWorkspaceProps = {
  conversations: Conversation[];
  messages: Message[];
  customers: Customer[];
  orders: Order[];
  products: SellableVariant[];
  quickReplies: QuickReply[];
  currentStaffId: string;
  currentStaffName: string;
  /** Admin / chủ shop — không bị khóa claim / TTL như nhân viên. */
  isAdmin?: boolean;
  /** Phút idle trước khi nhả claim — từ cấu hình shop. */
  replyClaimTtlMinutes?: number;
  /** Kênh đã nối / có hội thoại — để hiện pill từ cấu hình, không hardcode. */
  activeChannels?: Channel[];
  initialConversationId?: string;
  canUpdateCustomer?: boolean;
  canMergeOrders?: boolean;
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

/** Claim giữ ngoài useOptimistic — tránh UI snap-back khi transition kết thúc trước RSC. */

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
/** Soft sync gần realtime hơn (không WebSocket) — giống messenger poll nhẹ. */
const INBOX_SOFT_REFRESH_MS = 8_000;
/** Tick đã xem: poll nhỏ (không RSC) khi đang mở thread Meta. */
const RECEIPT_POLL_MS = 2_500;

/**
 * Next/React production ẩn lỗi Server Components thành minified #441.
 * Mutation thường đã OK — không hiện digest thô trên composer.
 * Server Action throw còn có thể về `undefined` / object digest — luôn có fallback.
 */
function inboxActionErrorMessage(err: unknown, fallback: string) {
  let raw = "";
  if (err instanceof Error) {
    raw = err.message;
  } else if (typeof err === "string") {
    raw = err;
  } else if (err && typeof err === "object") {
    const maybe = err as { message?: unknown; digest?: unknown; error?: unknown };
    if (typeof maybe.message === "string") raw = maybe.message;
    else if (typeof maybe.error === "string") raw = maybe.error;
  }
  if (
    /minified React error #441/i.test(raw) ||
    /error occurred in the Server Components render/i.test(raw)
  ) {
    return null;
  }
  return raw.trim() || fallback;
}

type ConfirmedOutboundResult = {
  id: string;
  conversationId: string;
  sender: Message["sender"];
  text: string;
  createdAt: string;
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  externalMessageId: string | null;
  deliveredAt: string | null;
  readAt: string | null;
};

function confirmLocalOutbound(
  item: LocalOutboundMessage,
  result: ConfirmedOutboundResult,
): LocalOutboundMessage {
  return {
    ...item,
    id: result.id,
    conversationId: result.conversationId,
    sender: result.sender,
    text: result.text,
    createdAt: result.createdAt,
    attachmentType: result.attachmentType,
    attachmentUrl: result.attachmentUrl,
    attachmentName: result.attachmentName,
    externalMessageId: result.externalMessageId,
    deliveredAt: result.deliveredAt,
    readAt: result.readAt,
    localStatus: undefined,
  };
}

export function InboxWorkspace({
  conversations,
  messages,
  customers,
  orders,
  products,
  quickReplies,
  currentStaffId,
  currentStaffName,
  isAdmin = false,
  replyClaimTtlMinutes = DEFAULT_REPLY_CLAIM_TTL_MINUTES,
  activeChannels,
  initialConversationId,
  canUpdateCustomer = false,
  canMergeOrders = false,
}: InboxWorkspaceProps) {
  const router = useRouter();
  const claimTtlMs = replyClaimTtlMs(replyClaimTtlMinutes) || REPLY_CLAIM_TTL_MS;
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
  const [listWidth, setListWidth] = usePersistedState(
    STORAGE_KEYS.inboxListWidth,
    INBOX_LIST_DEFAULT,
  );
  const [listCollapsed, setListCollapsed] = usePersistedState(
    STORAGE_KEYS.inboxListCollapsed,
    false,
  );
  const listResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const desktopListWidth = listCollapsed
    ? INBOX_LIST_COLLAPSED
    : clampInboxListWidth(listWidth);
  /** Chỉ khóa composer khi user đang claim/gửi — không dùng cho poll/mark-read/heartbeat. */
  const [actionPending, startAction] = useTransition();
  const [, startBackground] = useTransition();
  /** null đến khi mount — tránh hydration mismatch từ đồng hồ client. */
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [stickToBottom, setStickToBottom] = useState(true);
  const lastClaimTouchRef = useRef(0);
  const readMarkedRef = useRef(new Set<string>());
  /** Đã gọi release idle cho cặp conversation+claimedAt — tránh POST mỗi giây. */
  const idleReleasedRef = useRef(new Set<string>());
  /** Claim touch thất bại liên tiếp — backoff để heartbeat không spam. */
  const claimTouchFailUntilRef = useRef(0);
  /** Claim đang chờ server — send phải await để tránh race "UI mở / DB chưa claim". */
  const claimInFlightRef = useRef<Record<string, Promise<boolean>>>({});
  /** File ảnh theo tempId — cho phép Gửi lại khi fail. */
  const pendingImageFilesRef = useRef<Record<string, File>>({});
  /** id → lastAt lúc đánh dấu đã đọc — giữ badge=0 đến khi server/sync hoặc có tin mới. */
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});
  /** Meta readAt/deliveredAt poll — lật tick không đợi router.refresh. */
  const [messageReceiptOverlay, setMessageReceiptOverlay] = useState<
    Record<string, MessageReceiptPatch>
  >({});
  /** Claim bền ngoài useOptimistic — tránh khóa composer lại sau khi bấm "Tôi trả lời". */
  const [claimOverrides, setClaimOverrides] = useState<Record<string, ClaimOverride>>({});
  /** Claim/takeover đang chờ server — nút Tiếp quản không được kẹt disabled. */
  const [claimBusyId, setClaimBusyId] = useState<string | null>(null);
  const [customerPatches, setCustomerPatches] = useState<Record<string, Partial<Customer>>>({});
  /** Tin đang gửi / thất bại — giữ bubble kiểu messenger (status + gửi lại). */
  const [localOutbound, setLocalOutbound] = useState<LocalOutboundMessage[]>([]);
  const [outboundSyncSource, setOutboundSyncSource] = useState(messages);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [trackedSelectedId, setTrackedSelectedId] = useState(selectedId);
  const initialThreadId = initialConversationId || conversations[0]?.id || "";
  const initialThreadLen = initialThreadId
    ? messages.filter((item) => item.conversationId === initialThreadId).length
    : 0;
  const [trackedThreadKey, setTrackedThreadKey] = useState(
    `${initialThreadId}:${initialThreadLen}`,
  );
  const [prevInitialConversationId, setPrevInitialConversationId] = useState(initialConversationId);
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

  // Khi RSC mang tin shop mới về — bỏ local đã khớp (kể cả failed do race).
  if (messages !== outboundSyncSource) {
    setOutboundSyncSource(messages);
    const next = pruneSyncedOutbound(localOutbound, messages);
    if (next.length !== localOutbound.length) {
      setLocalOutbound(next);
    }
  }

  const customerById = useMemo(() => {
    const map = new Map(customers.map((item) => [item.id, item]));
    return (id: string) => map.get(id);
  }, [customers]);

  const conversationsView = useMemo(
    () =>
      optimisticConversations.map((item) => {
        const override = claimOverrides[item.id];
        return override
          ? {
              ...item,
              replyStaffId: override.replyStaffId,
              replyStaffName: override.replyStaffName,
              replyClaimedAt: override.replyClaimedAt,
            }
          : item;
      }),
    [optimisticConversations, claimOverrides],
  );

  // Đồng bộ override với props server (render-time — tránh setState trong effect).
  const [claimSyncSource, setClaimSyncSource] = useState(conversations);
  if (conversations !== claimSyncSource) {
    setClaimSyncSource(conversations);
    let changed = false;
    const next = { ...claimOverrides };
    for (const [id, override] of Object.entries(claimOverrides)) {
      const server = conversations.find((row) => row.id === id);
      if (!server) {
        delete next[id];
        changed = true;
        continue;
      }
      if (
        reconcileClaimOverride({
          serverStaffId: server.replyStaffId,
          serverClaimedAt: server.replyClaimedAt,
          override,
        }) === "drop"
      ) {
        delete next[id];
        changed = true;
      }
      // keep: sticky takeover/nhả, hoặc cùng người giữ — giữ mốc client (TTL).
    }
    if (changed) {
      setClaimOverrides(next);
    }
  }

  // Nếu kênh đang chọn biến mất khỏi bộ lọc (ngắt kết nối), về "Tất cả"
  const selectedFilter =
    channelFilters.some((item) => item.id === channel) ? channel : "all";

  const visible = useMemo(
    () =>
      conversationsView
        .filter((item) => selectedFilter === "all" || item.channel === selectedFilter)
        .map((item) => {
          const receiptLastAt = readReceipts[item.id];
          if (receiptLastAt && item.lastAt === receiptLastAt && item.unread > 0) {
            return { ...item, unread: 0 };
          }
          return item;
        })
        .sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt)),
    [selectedFilter, conversationsView, readReceipts],
  );

  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const customerBase = selected ? customerById(selected.customerId) : undefined;
  const customer = customerBase
    ? { ...customerBase, ...customerPatches[customerBase.id] }
    : undefined;
  const receiptMessages = applyMessageReceipts(messages, messageReceiptOverlay);
  const receiptLocalOutbound = applyMessageReceipts(localOutbound, messageReceiptOverlay);
  const thread = selected
    ? mergeConversationThread(receiptMessages, receiptLocalOutbound, selected.id)
    : [];
  const messagingWindow = selected
    ? getMessagingWindowInfo({
        channel: selected.channel,
        lastCustomerMessageAt: latestCustomerMessageAt(thread),
        now: nowMs === null ? undefined : new Date(nowMs),
      })
    : null;
  const receiptsEnabled =
    selected?.channel === "facebook" || selected?.channel === "instagram";
  const customerOrders = customer
    ? orders.filter((item) => item.customerId === customer.id)
    : [];
  const openNewOrders = customerOrders.filter((item) => item.status === "new");
  const canMergeOpenOrders = canMergeOrders && openNewOrders.length >= 2;

  const claimRemainingMs =
    nowMs !== null && selected?.replyClaimedAt
      ? replyClaimRemainingMs(selected.replyClaimedAt, nowMs, claimTtlMs)
      : 0;
  /** Trước khi mount: tin server (đã lọc TTL). Sau mount: đếm theo đồng hồ client. */
  const claimActive =
    nowMs === null
      ? Boolean(selected?.replyStaffId && selected?.replyClaimedAt)
      : Boolean(selected?.replyStaffId) && claimRemainingMs > 0;
  const replyLockedByOther = Boolean(
    !isAdmin &&
      claimActive &&
      selected?.replyStaffId &&
      selected.replyStaffId !== currentStaffId,
  );
  const replyIsMine = Boolean(
    claimActive && selected?.replyStaffId && selected.replyStaffId === currentStaffId,
  );
  /** Admin trả lời mọi lúc; nhân viên phải claim còn hạn. Không khóa theo actionPending — claim/refresh không được làm ô nhập bị disabled. */
  const canCompose = isAdmin || replyIsMine;
  const sendBusy = actionPending;
  const claimBusy = Boolean(selected && claimBusyId === selected.id);
  const claimCountdown =
    nowMs !== null && !isAdmin && claimActive && claimRemainingMs > 0
      ? formatReplyClaimCountdown(claimRemainingMs)
      : null;

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
    // Luôn tick đồng hồ client — không chỉ khi đã có claim. Nếu chỉ set 1 lần lúc mount
    // rồi đợi có claim mới interval, claim/send sẽ đóng dấu replyClaimedAt bằng nowMs cũ
    // → countdown nhảy ~1 phút (vd. TTL 5p hiện 4:01).
    const tick = () => setNowMs(Date.now());
    const frame = requestAnimationFrame(tick);
    const timer = window.setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  // Thu hồi blob / file tạm khi local outbound bị xóa (gửi OK, prune, hủy).
  const prevLocalOutboundRef = useRef(localOutbound);
  useEffect(() => {
    const prev = prevLocalOutboundRef.current;
    prevLocalOutboundRef.current = localOutbound;
    for (const item of prev) {
      if (localOutbound.some((row) => row.id === item.id)) continue;
      if (item.attachmentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(item.attachmentUrl);
      }
      delete pendingImageFilesRef.current[item.id];
    }
  }, [localOutbound]);

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
    if (!selected?.id) return;
    if (selected.channel !== "facebook" && selected.channel !== "instagram") return;
    const conversationId = selected.id;
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight) return;
      if (document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const result = await getConversationReceipts(conversationId);
        if (cancelled || !result.ok) return;
        setMessageReceiptOverlay((prev) => mergeReceiptOverlay(prev, result.receipts));
      } catch {
        // poll im lặng — tick sẽ bắt kịp lần sau
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(poll, RECEIPT_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [selected?.id, selected?.channel]);

  useEffect(() => {
    if (nowMs === null) {
      return;
    }
    if (isAdmin) {
      // Admin không timeout claim (banner + takeover). Đừng xóa override local.
      return;
    }
    if (!selected?.replyStaffId || !selected.replyClaimedAt) {
      return;
    }
    if (claimRemainingMs > 0) {
      return;
    }
    const id = selected.id;
    const claimedAt = selected.replyClaimedAt;
    const releaseKey = `${id}:${claimedAt}`;
    if (idleReleasedRef.current.has(releaseKey)) {
      return;
    }
    idleReleasedRef.current.add(releaseKey);
    const wasMine = selected.replyStaffId === currentStaffId;
    // Giữ override "đã nhả" — tránh snap-back về claim hết hạn từ props → spam release mỗi giây.
    queueMicrotask(() => {
      setClaimOverrides((prev) => ({
        ...prev,
        [id]: makeClaimOverride({
          replyStaffId: null,
          replyStaffName: null,
          replyClaimedAt: null,
          nowMs,
        }),
      }));
    });
    startBackground(() => {
      patchOptimisticConversation({
        id,
        replyStaffId: null,
        replyStaffName: null,
        replyClaimedAt: null,
      });
    });
    if (wasMine && !isAdmin) {
      void releaseConversation(id, "idle_timeout").catch(() => {
        // Không xóa idleReleasedRef — một lần fail không được POST lại mỗi giây.
      });
    }
  }, [
    nowMs,
    claimRemainingMs,
    selected?.id,
    selected?.replyStaffId,
    selected?.replyClaimedAt,
    currentStaffId,
    isAdmin,
    patchOptimisticConversation,
    startBackground,
  ]);

  useEffect(() => {
    setReadReceipts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, lastAt] of Object.entries(prev)) {
        const item = conversations.find((row) => row.id === id);
        if (!item || item.unread === 0 || item.lastAt !== lastAt) {
          delete next[id];
          readMarkedRef.current.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [conversations]);

  useEffect(() => {
    const id = selected?.id;
    const unread = selected?.unread ?? 0;
    if (!id || unread <= 0) {
      return;
    }
    if (readMarkedRef.current.has(id)) {
      return;
    }
    readMarkedRef.current.add(id);
    const lastAt = selected.lastAt;
    setReadReceipts((prev) => ({ ...prev, [id]: lastAt }));
    startBackground(() => {
      patchOptimisticConversation({ id, unread: 0 });
    });
    void markConversationRead(id)
      .then((result) => {
        if (result && "ok" in result && result.ok === false) {
          // Giữ readMarkedRef — không retry spam POST khi action 500.
          if (result.error) setError(result.error);
          return;
        }
        notifyInboxNoticesRefresh();
      })
      .catch((err) => {
        // Giữ readMarkedRef + readReceipts — xóa ngay sẽ làm effect chạy lại → spam POST 500.
        // Thử lại khi có tin mới (lastAt đổi) nhờ sync effect xóa receipt.
        const message = inboxActionErrorMessage(err, "Không đánh dấu đã đọc được");
        if (message) setError(message);
      });
  }, [selected?.id, selected?.unread, selected?.lastAt, patchOptimisticConversation, startBackground]);

  function renewClaimActivity(conversationId: string, options?: { force?: boolean; atMs?: number }) {
    if (nowMs === null && options?.atMs === undefined) {
      return;
    }
    // Luôn Date.now() khi không truyền atMs — tránh đóng dấu claim bằng nowMs lệch 1 tick.
    const at = options?.atMs ?? Date.now();
    if (at < claimTouchFailUntilRef.current) {
      return;
    }
    if (!options?.force && at - lastClaimTouchRef.current < CLAIM_TOUCH_MIN_INTERVAL_MS) {
      return;
    }
    lastClaimTouchRef.current = at;
    setNowMs(at);
    const claimedAt = new Date(at).toISOString();
    startBackground(() => {
      patchOptimisticConversation({
        id: conversationId,
        replyStaffId: currentStaffId,
        replyStaffName: currentStaffName,
        replyClaimedAt: claimedAt,
      });
    });
    void touchConversationClaim(conversationId)
      .then((result) => {
        if (result && "ok" in result && result.ok === false) {
          claimTouchFailUntilRef.current = Date.now() + CLAIM_HEARTBEAT_MS;
          return;
        }
        if ("skipped" in result && result.skipped) {
          return;
        }
        claimTouchFailUntilRef.current = 0;
        // Giữ mốc client (không dùng server claimedAt) — countdown khớp TTL; server vẫn enforce.
        const syncedAt = Date.now();
        const syncedClaimedAt = new Date(syncedAt).toISOString();
        setNowMs(syncedAt);
        startBackground(() => {
          patchOptimisticConversation({
            id: conversationId,
            replyClaimedAt: syncedClaimedAt,
          });
        });
        setClaimOverrides((prev) => {
          const cur = prev[conversationId];
          if (!cur?.replyStaffId) return prev;
          return {
            ...prev,
            [conversationId]: { ...cur, replyClaimedAt: syncedClaimedAt },
          };
        });
      })
      .catch(() => {
        // Backoff 2 phút — khớp nhịp heartbeat, tránh spam khi action đang 500.
        claimTouchFailUntilRef.current = Date.now() + CLAIM_HEARTBEAT_MS;
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

  function onListResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (listCollapsed) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    listResizeRef.current = {
      startX: event.clientX,
      startWidth: clampInboxListWidth(listWidth),
    };
  }

  function onListResizePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = listResizeRef.current;
    if (!drag) return;
    setListWidth(clampInboxListWidth(drag.startWidth + (event.clientX - drag.startX)));
  }

  function onListResizePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!listResizeRef.current) return;
    listResizeRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }

  function nudgeListWidth(delta: number) {
    setListCollapsed(false);
    setListWidth((prev) => clampInboxListWidth(clampInboxListWidth(prev) + delta));
  }

  function changeTag(tag: ConversationTag) {
    if (!selected || selected.tag === tag || actionPending) return;

    startAction(async () => {
      patchOptimisticConversation({ id: selected.id, tag });
      try {
        await updateConversationTag(selected.id, tag);
      } catch (err) {
        const message = inboxActionErrorMessage(err, "Đổi nhãn thất bại");
        if (message) setError(message);
        else router.refresh();
      }
    });
  }

  function claimReply() {
    if (!selected || sendBusy || replyLockedByOther || claimBusy) return;
    // Event handler — Date.now() (không dùng nowMs lệch tick; countdown 5:00).
    // eslint-disable-next-line react-hooks/purity -- click handler, not render
    const atMs = Date.now();
    setNowMs(atMs);
    const claimedAt = new Date(atMs).toISOString();
    const conversationId = selected.id;
    setClaimBusyId(conversationId);
    setClaimOverrides((prev) => ({
      ...prev,
      [conversationId]: makeClaimOverride({
        replyStaffId: currentStaffId,
        replyStaffName: currentStaffName,
        replyClaimedAt: claimedAt,
        nowMs: atMs,
      }),
    }));
    setError(null);

    const claimPromise = (async () => {
      try {
        const result = await claimConversation(conversationId);
        if (!result.ok) {
          setClaimOverrides((prev) => {
            if (!(conversationId in prev)) return prev;
            const next = { ...prev };
            delete next[conversationId];
            return next;
          });
          setError(result.error);
          return false;
        }
        const syncedAt = Date.now();
        const syncedClaimedAt = new Date(syncedAt).toISOString();
        setNowMs(syncedAt);
        lastClaimTouchRef.current = syncedAt;
        claimTouchFailUntilRef.current = 0;
        for (const key of [...idleReleasedRef.current]) {
          if (key.startsWith(`${conversationId}:`)) {
            idleReleasedRef.current.delete(key);
          }
        }
        setClaimOverrides((prev) => ({
          ...prev,
          [conversationId]: makeClaimOverride({
            replyStaffId: currentStaffId,
            replyStaffName: currentStaffName,
            replyClaimedAt: syncedClaimedAt,
            nowMs: syncedAt,
          }),
        }));
        startBackground(() => {
          patchOptimisticConversation({
            id: conversationId,
            replyStaffId: currentStaffId,
            replyStaffName: currentStaffName,
            replyClaimedAt: syncedClaimedAt,
          });
        });
        queueMicrotask(() => composerRef.current?.focus());
        return true;
      } catch (err) {
        setClaimOverrides((prev) => {
          if (!(conversationId in prev)) return prev;
          const next = { ...prev };
          delete next[conversationId];
          return next;
        });
        const message = inboxActionErrorMessage(err, "Không nhận được hội thoại");
        if (message) setError(message);
        return false;
      } finally {
        delete claimInFlightRef.current[conversationId];
        setClaimBusyId((current) => (current === conversationId ? null : current));
      }
    })();
    claimInFlightRef.current[conversationId] = claimPromise;

    startBackground(() => {
      patchOptimisticConversation({
        id: conversationId,
        replyStaffId: currentStaffId,
        replyStaffName: currentStaffName,
        replyClaimedAt: claimedAt,
      });
      void claimPromise;
    });
  }

  async function waitForClaimIfNeeded(conversationId: string) {
    const pending = claimInFlightRef.current[conversationId];
    if (!pending) return true;
    return pending;
  }

  function releaseReply() {
    if (!selected || sendBusy || claimBusy || (!replyIsMine && !isAdmin)) return;
    const conversationId = selected.id;
    const previous = makeClaimOverride({
      replyStaffId: selected.replyStaffId ?? null,
      replyStaffName: selected.replyStaffName ?? null,
      replyClaimedAt: selected.replyClaimedAt ?? null,
    });
    setClaimBusyId(conversationId);
    setClaimOverrides((prev) => ({
      ...prev,
      [conversationId]: makeClaimOverride({
        replyStaffId: null,
        replyStaffName: null,
        replyClaimedAt: null,
      }),
    }));
    startBackground(async () => {
      patchOptimisticConversation({
        id: conversationId,
        replyStaffId: null,
        replyStaffName: null,
        replyClaimedAt: null,
      });
      try {
        const result = await releaseConversation(conversationId);
        if (result && "ok" in result && result.ok === false) {
          setClaimOverrides((prev) => ({
            ...prev,
            [conversationId]: previous,
          }));
          setError(result.error);
          return;
        }
      } catch (err) {
        setClaimOverrides((prev) => ({
          ...prev,
          [conversationId]: previous,
        }));
        const message = inboxActionErrorMessage(err, "Không nhả được hội thoại");
        if (message) setError(message);
      } finally {
        setClaimBusyId((current) => (current === conversationId ? null : current));
      }
    });
  }

  function onDraftChange(value: string) {
    setDraft(value);
    if (!selected || isAdmin || !replyIsMine || !value.trim()) {
      return;
    }
    renewClaimActivity(selected.id);
  }

  function send(text: string) {
    if (!selected || !text.trim() || sendBusy || !canCompose || nowMs === null) {
      return;
    }

    // eslint-disable-next-line react-hooks/purity -- click/submit handler, not render
    const atMs = Date.now();
    setNowMs(atMs);
    const body = text.trim();
    const tempId = `temp-${crypto.randomUUID()}`;
    const sentAt = new Date(atMs).toISOString();
    const conversationId = selected.id;
    const optimistic: LocalOutboundMessage = {
      id: tempId,
      conversationId,
      sender: "shop",
      text: body,
      createdAt: sentAt,
      reactions: [],
      localStatus: "sending",
    };

    setError(null);
    setDraft("");
    lastClaimTouchRef.current = atMs;
    setReadReceipts((prev) => ({ ...prev, [conversationId]: sentAt }));
    setLocalOutbound((prev) => [...prev.filter((item) => item.id !== tempId), optimistic]);
    setStickToBottom(true);
    setPendingNewCount(0);
    if (!isAdmin) {
      setClaimOverrides((prev) => ({
        ...prev,
        [conversationId]: makeClaimOverride({
          replyStaffId: currentStaffId,
          replyStaffName: currentStaffName,
          replyClaimedAt: sentAt,
          nowMs: atMs,
        }),
      }));
    }

    startAction(async () => {
      if (!isAdmin) {
        const claimed = await waitForClaimIfNeeded(conversationId);
        if (!claimed) {
          setLocalOutbound((prev) => prev.filter((item) => item.id !== tempId));
          setDraft(body);
          return;
        }
      }
      patchOptimisticConversation({
        id: conversationId,
        lastMessage: body,
        lastAt: sentAt,
        unread: 0,
        ...(isAdmin
          ? replyIsMine
            ? {
                replyStaffId: null,
                replyStaffName: null,
                replyClaimedAt: null,
              }
            : {}
          : {
              replyStaffId: currentStaffId,
              replyStaffName: currentStaffName,
              replyClaimedAt: sentAt,
            }),
      });
      if (isAdmin && replyIsMine) {
        setClaimOverrides((prev) => ({
          ...prev,
          [conversationId]: makeClaimOverride({
            replyStaffId: null,
            replyStaffName: null,
            replyClaimedAt: null,
          }),
        }));
      }

      try {
        const result = await sendMessage(conversationId, body);
        if (!result.ok) {
          setLocalOutbound((prev) =>
            prev.map((item) =>
              item.id === tempId ? { ...item, localStatus: "failed" as const } : item,
            ),
          );
          setError(result.error);
          return;
        }
        setLocalOutbound((prev) =>
          prev.map((item) =>
            item.id === tempId ? confirmLocalOutbound(item, result) : item,
          ),
        );
        notifyInboxNoticesRefresh();
        router.refresh();
        queueMicrotask(() => composerRef.current?.focus());
      } catch (err) {
        setLocalOutbound((prev) =>
          prev.map((item) =>
            item.id === tempId ? { ...item, localStatus: "failed" as const } : item,
          ),
        );
        const message = inboxActionErrorMessage(err, "Gửi tin thất bại");
        if (message) setError(message);
      }
    });
  }

  function retryFailedMessage(messageId: string) {
    const failed = localOutbound.find(
      (item) => item.id === messageId && item.localStatus === "failed",
    );
    if (!failed || !canCompose || nowMs === null) return;
    if (sendBusy) {
      setError("Đang gửi tin khác — bấm Gửi lại sau giây lát.");
      return;
    }

    const pendingFile = pendingImageFilesRef.current[messageId];
    if (failed.attachmentType === "image") {
      if (!pendingFile) {
        setError("Ảnh tạm đã hết — chọn lại ảnh để gửi.");
        return;
      }
      if (failed.attachmentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(failed.attachmentUrl);
      }
      delete pendingImageFilesRef.current[messageId];
      setLocalOutbound((prev) => prev.filter((item) => item.id !== messageId));
      sendImage(pendingFile);
      return;
    }

    setLocalOutbound((prev) => prev.filter((item) => item.id !== messageId));
    send(failed.text);
  }

  function insertEmoji(emoji: string) {
    if (!canCompose || !selected) return;
    setDraft((value) => `${value}${emoji}`);
    if (!isAdmin && replyIsMine) {
      renewClaimActivity(selected.id);
    }
    queueMicrotask(() => composerRef.current?.focus());
  }

  function sendImage(file: File) {
    if (!selected || sendBusy || !canCompose || nowMs === null) return;

    // eslint-disable-next-line react-hooks/purity -- click handler, not render
    const atMs = Date.now();
    setNowMs(atMs);
    const tempId = `temp-${crypto.randomUUID()}`;
    const sentAt = new Date(atMs).toISOString();
    const conversationId = selected.id;
    const previewUrl = URL.createObjectURL(file);
    const optimistic: LocalOutboundMessage = {
      id: tempId,
      conversationId,
      sender: "shop",
      text: "[Ảnh]",
      createdAt: sentAt,
      attachmentType: "image",
      attachmentUrl: previewUrl,
      attachmentName: file.name,
      reactions: [],
      localStatus: "sending",
    };

    setError(null);
    lastClaimTouchRef.current = atMs;
    setReadReceipts((prev) => ({ ...prev, [conversationId]: sentAt }));
    setLocalOutbound((prev) => [...prev, optimistic]);
    pendingImageFilesRef.current[tempId] = file;
    setStickToBottom(true);
    setPendingNewCount(0);
    if (!isAdmin) {
      setClaimOverrides((prev) => ({
        ...prev,
        [conversationId]: makeClaimOverride({
          replyStaffId: currentStaffId,
          replyStaffName: currentStaffName,
          replyClaimedAt: sentAt,
          nowMs: atMs,
        }),
      }));
    }

    startAction(async () => {
      if (!isAdmin) {
        const claimed = await waitForClaimIfNeeded(conversationId);
        if (!claimed) {
          setLocalOutbound((prev) => prev.filter((item) => item.id !== tempId));
          delete pendingImageFilesRef.current[tempId];
          URL.revokeObjectURL(previewUrl);
          return;
        }
      }
      patchOptimisticConversation({
        id: conversationId,
        lastMessage: "[Ảnh]",
        lastAt: sentAt,
        unread: 0,
        ...(isAdmin
          ? replyIsMine
            ? {
                replyStaffId: null,
                replyStaffName: null,
                replyClaimedAt: null,
              }
            : {}
          : {
              replyStaffId: currentStaffId,
              replyStaffName: currentStaffName,
              replyClaimedAt: sentAt,
            }),
      });
      if (isAdmin && replyIsMine) {
        setClaimOverrides((prev) => ({
          ...prev,
          [conversationId]: makeClaimOverride({
            replyStaffId: null,
            replyStaffName: null,
            replyClaimedAt: null,
          }),
        }));
      }

      try {
        const formData = new FormData();
        formData.set("file", file);
        const result = await sendImageMessage(conversationId, formData);
        if (!result.ok) {
          setLocalOutbound((prev) =>
            prev.map((item) =>
              item.id === tempId ? { ...item, localStatus: "failed" as const } : item,
            ),
          );
          setError(result.error);
          return;
        }
        setLocalOutbound((prev) =>
          prev.map((item) =>
            item.id === tempId ? confirmLocalOutbound(item, result) : item,
          ),
        );
        delete pendingImageFilesRef.current[tempId];
        notifyInboxNoticesRefresh();
        router.refresh();
        URL.revokeObjectURL(previewUrl);
      } catch (err) {
        setLocalOutbound((prev) =>
          prev.map((item) =>
            item.id === tempId ? { ...item, localStatus: "failed" as const } : item,
          ),
        );
        const message = inboxActionErrorMessage(err, "Gửi ảnh thất bại");
        if (message) setError(message);
        // Giữ blob URL để xem lại ảnh lỗi; revoke khi user bỏ / gửi lại.
      }
    });
  }

  function react(messageId: string, emoji: string) {
    if (!canCompose || sendBusy) return;
    setError(null);
    startAction(async () => {
      try {
        await reactToMessage(messageId, emoji);
        router.refresh();
      } catch (err) {
        const message = inboxActionErrorMessage(err, "Không gửi được reaction");
        if (message) setError(message);
        else router.refresh();
      }
    });
  }

  const showList = mobilePane === "list";
  const showChat = mobilePane === "chat";
  const showCustomer = mobilePane === "customer";

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section
        aria-label="Danh sách hội thoại"
        className={`relative flex flex-col border-border-strong bg-surface transition-[width] duration-150 lg:border-r ${
          showList ? "flex min-h-0 w-full flex-1" : "hidden"
        } lg:flex lg:min-h-0 lg:w-[var(--inbox-list-current)] lg:max-w-[var(--inbox-list-current)] lg:flex-none lg:shrink-0`}
        style={{ ["--inbox-list-current" as string]: `${desktopListWidth}px` }}
      >
        {listCollapsed ? (
          <div className="hidden h-full min-h-0 w-full flex-col lg:flex">
            <div className="flex shrink-0 justify-center border-b border-border py-3">
              <button
                type="button"
                onClick={() => setListCollapsed(false)}
                className="icon-btn"
                aria-label="Mở rộng danh sách hội thoại"
                title="Mở rộng danh sách"
              >
                <ListExpandIcon />
              </button>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5 py-2">
              {visible.map((item) => {
                const person = customerById(item.customerId);
                const active = selected?.id === item.id;
                const name = person?.name ?? "Khách";
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(item.id)}
                      className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                        active ? "bg-accent-muted ring-2 ring-teal-500" : "hover:bg-surface-muted"
                      }`}
                      aria-label={name}
                      aria-current={active ? "true" : undefined}
                      title={name}
                    >
                        <CustomerAvatar
                          name={name}
                          channel={item.channel}
                          avatarUrl={person?.avatarUrl}
                          size="sm"
                        />
                      {item.unread > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white">
                          {item.unread > 9 ? "9+" : item.unread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div
          className={`min-h-0 w-full flex-col ${
            listCollapsed ? "flex lg:hidden" : "flex"
          } ${showList || !listCollapsed ? "flex-1" : ""}`}
        >
          <div className="border-b border-border bg-surface/90 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-teal-950">Inbox</h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {inboxChannelsSubtitle(channelFilters)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setListCollapsed(true)}
                className="icon-btn hidden shrink-0 lg:inline-flex"
                aria-label="Thu gọn danh sách hội thoại"
                title="Thu gọn danh sách"
              >
                <ListCollapseIcon />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {channelFilters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setChannel(item.id)}
                  aria-pressed={selectedFilter === item.id}
                  className={`filter-pill min-h-9 ${
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
                {activeChannels && activeChannels.length === 0 ? (
                  <>
                    Chưa có kênh nào đang nối.{" "}
                    <Link
                      href="/settings"
                      className="font-medium text-teal-700 underline-offset-2 hover:underline"
                    >
                      Vào Cài đặt để kết nối
                    </Link>
                  </>
                ) : (
                  "Không có hội thoại phù hợp bộ lọc"
                )}
              </li>
            ) : null}
            {visible.map((item) => {
              const person = customerById(item.customerId);
              const active = selected?.id === item.id;
              const name = person?.name ?? "Khách";
              const itemClaimActive =
                nowMs === null
                  ? Boolean(item.replyStaffId && item.replyClaimedAt)
                  : Boolean(item.replyStaffId) &&
                    replyClaimRemainingMs(item.replyClaimedAt, nowMs, claimTtlMs) > 0;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(item.id)}
                    className={`flex min-h-14 w-full cursor-pointer items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors duration-200 sm:px-4 sm:py-3.5 ${
                      active
                        ? "border-l-[3px] border-l-teal-500 bg-accent-muted"
                        : "border-l-[3px] border-l-transparent hover:bg-surface-muted"
                    }`}
                  >
                    <CustomerAvatar
                      name={name}
                      channel={item.channel}
                      avatarUrl={person?.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {formatTime(item.lastAt)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
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
                        {item.unread > 0 ? (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">
                            {item.unread}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.lastMessage}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {!listCollapsed ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={INBOX_LIST_MIN}
            aria-valuemax={INBOX_LIST_MAX}
            aria-valuenow={clampInboxListWidth(listWidth)}
            aria-label="Kéo để đổi độ rộng danh sách hội thoại. Mũi tên trái/phải để chỉnh."
            tabIndex={0}
            onPointerDown={onListResizePointerDown}
            onPointerMove={onListResizePointerMove}
            onPointerUp={onListResizePointerUp}
            onPointerCancel={onListResizePointerUp}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                nudgeListWidth(-16);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                nudgeListWidth(16);
              } else if (event.key === "Home") {
                event.preventDefault();
                setListWidth(INBOX_LIST_MIN);
              } else if (event.key === "End") {
                event.preventDefault();
                setListWidth(INBOX_LIST_MAX);
              }
            }}
            className="absolute inset-y-0 right-0 z-10 hidden w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-teal-400/40 focus-visible:bg-teal-500/50 focus-visible:outline-none lg:block"
          />
        ) : null}
      </section>

      <section
        className={`flex min-w-0 flex-col bg-[linear-gradient(180deg,#f0fdfa_0%,#e8f1f4_100%)] ${
          showChat ? "min-h-0 flex-1" : "hidden lg:flex lg:min-h-0 lg:flex-1"
        }`}
      >
        {selected && customer ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setMobilePane("list")}
                  className="icon-btn shrink-0 lg:hidden"
                  aria-label="Quay lại danh sách hội thoại"
                >
                  <BackIcon />
                </button>
                {listCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setListCollapsed(false)}
                    className="icon-btn hidden shrink-0 lg:inline-flex"
                    aria-label="Mở rộng danh sách hội thoại"
                    title="Mở danh sách"
                  >
                    <ListExpandIcon />
                  </button>
                ) : null}
                <CustomerAvatar
                  name={customer.name}
                  channel={selected.channel}
                  avatarUrl={customer.avatarUrl}
                  size="sm"
                  className="hidden sm:inline-flex"
                />
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
                        disabled={actionPending}
                        onChange={(event) => changeTag(event.target.value as ConversationTag)}
                        className="min-h-9 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-teal-500"
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
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!claimActive ? (
                  isAdmin ? null : (
                    <button
                      type="button"
                      disabled={actionPending || claimBusy}
                      onClick={claimReply}
                      className="btn-primary-sm"
                    >
                      {claimBusy ? "Đang nhận…" : "Tôi trả lời"}
                    </button>
                  )
                ) : replyIsMine ? (
                  <div className="flex items-center gap-2">
                    {claimCountdown ? (
                      <span className="text-[11px] tabular-nums text-slate-500" title="Hết hạn nếu không dùng">
                        Còn {claimCountdown}
                      </span>
                    ) : isAdmin ? (
                      <span className="text-[11px] text-teal-700">Admin · không timeout claim</span>
                    ) : null}
                    <button
                      type="button"
                      disabled={actionPending || claimBusy}
                      onClick={releaseReply}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-surface-muted disabled:opacity-50"
                    >
                      {claimBusy ? "Đang cập nhật…" : "Nhả hội thoại"}
                    </button>
                  </div>
                ) : isAdmin ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                      {selected.replyStaffName ?? "NV khác"} đang trả lời
                    </span>
                    <button
                      type="button"
                      disabled={actionPending || claimBusy}
                      onClick={claimReply}
                      className="btn-primary-sm"
                    >
                      {claimBusy ? "Đang tiếp quản…" : "Tiếp quản"}
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
                  className="sticky top-2 z-10 mx-auto mb-2 block rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 shadow-sm"
                  aria-live="polite"
                >
                  {pendingNewCount} tin mới — xem ngay
                </button>
              ) : null}
              {thread.length === 0 ? (
                <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
                  <p className="text-sm font-medium text-slate-600">Chưa có tin nhắn</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Tin đồng bộ từ kênh sẽ hiện tại đây
                  </p>
                </div>
              ) : null}
              {thread.map((item, index) => {
                const day = chatDayKey(item.createdAt);
                const prevDay = index > 0 ? chatDayKey(thread[index - 1]!.createdAt) : null;
                const showDay = day !== prevDay;
                return (
                  <Fragment key={item.id}>
                    {showDay ? (
                      <div className="flex justify-center py-1">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                          {nowMs != null
                            ? formatChatDayLabel(item.createdAt, new Date(nowMs))
                            : "\u00a0"}
                        </span>
                      </div>
                    ) : null}
                    <MessageBubble
                      message={item}
                      showReceipt={receiptsEnabled}
                      canReact={Boolean(
                        (isAdmin || replyIsMine) &&
                          !item.id.startsWith("temp-") &&
                          !item.localStatus,
                      )}
                      onReact={react}
                      onRetry={retryFailedMessage}
                    />
                  </Fragment>
                );
              })}
            </div>
            <footer className="border-t border-border bg-surface p-3 sm:p-4">
              {error ? (
                <p role="alert" className="alert-error mb-2 text-xs">
                  {error}
                </p>
              ) : null}
              {messagingWindow?.banner ? (
                <p
                  role="status"
                  className={`mb-2 rounded-lg border px-3 py-2 text-xs leading-5 ${
                    messagingWindow.kind === "closed"
                      ? "border-rose-200 bg-rose-50 text-rose-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {messagingWindow.banner}
                </p>
              ) : null}
              {isAdmin ? (
                <p className="mb-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                  <span className="activity-dot activity-dot-mine" aria-hidden />
                  <span>
                    Admin: trả lời mọi lúc, không bị khóa và không khóa hội thoại khi gửi tin
                    {claimActive && !replyIsMine && selected.replyStaffName
                      ? ` · ${selected.replyStaffName} đang giữ (bấm Tiếp quản chỉ khi cần chiếm claim).`
                      : "."}
                  </span>
                </p>
              ) : replyLockedByOther ? (
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
                      ? ` · tự nhả sau ${claimCountdown} nếu không hoạt động (${replyClaimTtlMinutes} phút).`
                      : "."}
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
                    title={`Chèn mẫu: ${item.title}`}
                    aria-label={`Chèn mẫu tin ${item.title} vào ô soạn`}
                    onClick={() => {
                      setDraft(item.text);
                      setError(null);
                      if (!isAdmin && replyIsMine && selected) {
                        renewClaimActivity(selected.id);
                      }
                      queueMicrotask(() => composerRef.current?.focus());
                    }}
                    className="min-h-9 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:border-teal-200 hover:bg-accent-muted hover:text-teal-800 disabled:opacity-50"
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
                <div className="flex shrink-0 gap-1 pb-1">
                  <EmojiPickerButton disabled={!canCompose} onPick={insertEmoji} />
                  <ImagePickerButton
                    disabled={!canCompose}
                    onFile={sendImage}
                    onReject={(message) => setError(message)}
                  />
                </div>
                <div className="relative min-w-0 flex-1">
                  <textarea
                    ref={composerRef}
                    value={draft}
                    rows={2}
                    maxLength={MESSAGE_TEXT_MAX}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        send(draft);
                      }
                    }}
                    aria-label="Soạn tin nhắn"
                    aria-describedby="composer-count"
                    placeholder={
                      isAdmin || replyIsMine
                        ? "Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
                        : replyLockedByOther
                          ? "Đang bị khóa..."
                          : "Nhận hội thoại để trả lời..."
                    }
                    disabled={!canCompose}
                    className="input-field-sm min-h-11 w-full resize-none py-2.5"
                  />
                  {draft.length >= MESSAGE_TEXT_MAX - 200 ? (
                    <p
                      id="composer-count"
                      className={`mt-1 text-right text-[11px] ${
                        draft.length >= MESSAGE_TEXT_MAX - 20 ? "text-rose-600" : "text-slate-400"
                      }`}
                    >
                      {draft.length}/{MESSAGE_TEXT_MAX}
                    </p>
                  ) : (
                    <span id="composer-count" className="sr-only">
                      Tối đa {MESSAGE_TEXT_MAX} ký tự
                    </span>
                  )}
                </div>
                {sendBusy || draft.trim() ? (
                  <button
                    type="submit"
                    disabled={!canCompose || sendBusy}
                    aria-busy={sendBusy}
                    className="btn-primary-sm shrink-0"
                  >
                    {sendBusy ? "Đang gửi…" : "Gửi"}
                  </button>
                ) : (
                  <LikeSendButton
                    disabled={!canCompose}
                    onSend={() => send(COMPOSER_LIKE_EMOJI)}
                  />
                )}
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
            <div className="mt-3 flex items-center gap-3">
              <CustomerAvatar
                name={customer.name}
                channel={selected?.channel}
                avatarUrl={customer.avatarUrl}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-900">{customer.name}</p>
                <p className="mt-0.5 text-sm text-slate-600">{customer.phone ?? "Chưa có SĐT"}</p>
              </div>
            </div>
            {canUpdateCustomer ? (
              <CustomerProfileForm
                key={customer.id}
                customer={customer}
                onSaved={(patch) => {
                  setCustomerPatches((prev) => ({
                    ...prev,
                    [customer.id]: { ...prev[customer.id], ...patch },
                  }));
                }}
              />
            ) : customer.note ? (
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
              {canMergeOpenOrders ? (
                <button
                  type="button"
                  disabled={actionPending}
                  className="btn-secondary mt-3 w-full min-h-10 text-xs"
                  onClick={() => {
                    if (
                      !customer ||
                      !window.confirm(
                        `Gộp ${openNewOrders.length} đơn «Mới» của khách này vào đơn cũ nhất? Các đơn còn lại sẽ hủy.`,
                      )
                    ) {
                      return;
                    }
                    startAction(async () => {
                      const result = await mergeCustomerOpenOrdersAction(customer.id);
                      if (result.ok) {
                        router.refresh();
                      } else {
                        window.alert(result.error);
                      }
                    });
                  }}
                >
                  {actionPending
                    ? "Đang gộp…"
                    : `Gộp ${openNewOrders.length} đơn «Mới»`}
                </button>
              ) : null}
              <div className="mt-3 space-y-2">
                {customerOrders.length === 0 && (
                  <p className="text-sm text-slate-500">Chưa có đơn</p>
                )}
                {customerOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 transition-colors duration-150 hover:bg-surface"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{order.code}</p>
                      <span className="text-[11px] font-medium text-slate-500">
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </div>
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

      <nav className="flex shrink-0 border-t border-border bg-surface lg:hidden" aria-label="Điều hướng Inbox">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePane(tab.id)}
            aria-current={mobilePane === tab.id ? "page" : undefined}
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

function ListCollapseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M14 9l-3 3 3 3" />
    </svg>
  );
}

function ListExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M13 15l3-3-3-3" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
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
