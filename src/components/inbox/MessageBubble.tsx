"use client";

import { formatTime } from "@/lib/labels";
import type { Message } from "@/lib/types";
import { QUICK_REACT_EMOJIS } from "@/components/inbox/MessageComposerTools";

type MessageBubbleProps = {
  message: Message;
  canReact: boolean;
  onReact: (messageId: string, emoji: string) => void;
};

export function MessageBubble({ message, canReact, onReact }: MessageBubbleProps) {
  const isShop = message.sender === "shop";
  const showText = message.text && message.text !== "[Ảnh]";

  return (
    <div className={`group flex ${isShop ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[var(--chat-bubble-max)]">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-colors duration-150 ${
            isShop
              ? "rounded-br-md bg-teal-600 text-white"
              : "rounded-bl-md border border-border bg-surface text-slate-800"
          }`}
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
          <p className={`mt-1.5 text-[10px] ${isShop ? "text-teal-100" : "text-slate-400"}`}>
            {formatTime(message.createdAt)}
          </p>
        </div>

        {canReact ? (
          <div
            className={`pointer-events-none absolute ${
              isShop ? "right-0" : "left-0"
            } -top-3 z-10 flex gap-0.5 rounded-full border border-border bg-surface px-1 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100`}
          >
            {QUICK_REACT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded-full px-1 text-sm hover:bg-surface-muted"
                onClick={() => onReact(message.id, emoji)}
                aria-label={`React ${emoji}`}
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
