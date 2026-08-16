"use client";

import { formatTime } from "@/lib/labels";
import type { Message, MessageLocalStatus } from "@/lib/types";
import { QUICK_REACT_EMOJIS } from "@/components/inbox/MessageComposerTools";

type MessageBubbleProps = {
  message: Message;
  canReact: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onRetry?: (messageId: string) => void;
};

export function MessageBubble({ message, canReact, onReact, onRetry }: MessageBubbleProps) {
  const isShop = message.sender === "shop";
  const showText = message.text && message.text !== "[Ảnh]";
  const status: MessageLocalStatus | undefined = message.localStatus;
  const isFailed = status === "failed";
  const isSending = status === "sending";

  return (
    <div className={`group flex ${isShop ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[var(--chat-bubble-max)]">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-colors duration-200 ${
            isFailed
              ? "rounded-br-md border border-red-200 bg-red-50 text-slate-800 shadow-sm"
              : isShop
                ? "rounded-br-md bg-teal-700 text-white shadow-md"
                : "rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm"
          } ${isSending ? "opacity-80" : ""}`}
        >
          {message.attachmentUrl ? (
            // Native img: attachment may be local /api/uploads or Meta CDN URL.
            // eslint-disable-next-line @next/next/no-img-element -- dynamic upload/CDN URLs
            <img
              src={message.attachmentUrl}
              alt={message.attachmentName ?? "Ảnh đính kèm"}
              className="mb-2 max-h-56 w-full rounded-lg object-cover"
            />
          ) : null}
          {showText ? <p className="whitespace-pre-wrap">{message.text}</p> : null}
          <div
            className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
              isFailed ? "text-red-600" : isShop ? "text-teal-100" : "text-slate-400"
            }`}
          >
            <span>{formatTime(message.createdAt)}</span>
            {isSending ? (
              <span className="inline-flex items-center gap-1" aria-label="Đang gửi">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                Đang gửi
              </span>
            ) : null}
            {isFailed ? <span aria-label="Gửi thất bại">Gửi lỗi</span> : null}
            {isShop && !status ? (
              <span className="inline-flex" aria-label="Đã gửi" title="Đã gửi">
                <CheckIcon />
              </span>
            ) : null}
          </div>
        </div>

        {isFailed && onRetry ? (
          <div className={`mt-1.5 flex ${isShop ? "justify-end" : "justify-start"}`}>
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
            >
              Gửi lại
            </button>
          </div>
        ) : null}

        {canReact && !status ? (
          <div
            role="toolbar"
            aria-label="Thả cảm xúc nhanh"
            className={`absolute ${
              isShop ? "right-0" : "left-0"
            } -top-3 z-10 flex gap-0.5 rounded-full border border-border bg-surface px-1 py-0.5 shadow-sm transition-opacity duration-150 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-within:opacity-100`}
          >
            {QUICK_REACT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-1 text-sm hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                onClick={() => onReact(message.id, emoji)}
                aria-label={`Thả cảm xúc ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {message.reactions && message.reactions.length > 0 ? (
          <div className={`mt-1 flex flex-wrap gap-1 ${isShop ? "justify-end" : "justify-start"}`}>
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                disabled={!canReact}
                onClick={() => onReact(message.id, reaction.emoji)}
                aria-label={`${reaction.emoji}, ${reaction.count} phản ứng`}
                aria-pressed={reaction.reactedByMe}
                className={`rounded-full border px-1.5 py-0.5 text-[11px] ${
                  reaction.reactedByMe
                    ? "border-teal-300 bg-teal-50 text-teal-800"
                    : "border-border bg-surface text-slate-600"
                }`}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
