"use client";

import { useEffect, useRef, useState } from "react";
import { validateImageFileForUpload } from "@/lib/inbox-media";

export const COMPOSER_EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😍",
  "😊",
  "😉",
  "😎",
  "🤔",
  "😅",
  "😭",
  "😡",
  "👍",
  "👎",
  "👏",
  "🙏",
  "❤️",
  "🔥",
  "✨",
  "🎉",
  "✅",
  "❌",
  "💯",
  "📦",
  "🚚",
  "💰",
  "🛍️",
  "📱",
  "👋",
  "🤝",
  "⭐",
] as const;

export const QUICK_REACT_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

type EmojiPickerButtonProps = {
  disabled?: boolean;
  onPick: (emoji: string) => void;
};

export function EmojiPickerButton({ disabled, onPick }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="icon-btn"
        aria-label="Chèn emoji"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Emoji"
      >
        <SmileIcon />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Chọn emoji"
          className="absolute bottom-full left-0 z-20 grid w-56 grid-cols-6 gap-1 rounded-xl border border-border bg-surface p-2 shadow-elevated"
        >
          {COMPOSER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-lg hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
              aria-label={`Chèn ${emoji}`}
              onClick={() => {
                onPick(emoji);
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ImagePickerButtonProps = {
  disabled?: boolean;
  onFile: (file: File) => void;
  onReject?: (message: string) => void;
};

export function ImagePickerButton({ disabled, onFile, onReject }: ImagePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const check = validateImageFileForUpload(file);
          if (!check.ok) {
            onReject?.(check.error);
            return;
          }
          onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="icon-btn"
        aria-label="Gửi ảnh JPEG, PNG, WebP hoặc GIF, tối đa 10MB"
        title="Gửi ảnh (JPEG, PNG, WebP, GIF — tối đa 10MB)"
      >
        <ImageIcon />
      </button>
    </>
  );
}

function SmileIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9.5" x2="9.1" y2="9.5" strokeLinecap="round" />
      <line x1="15" y1="9.5" x2="15.1" y2="9.5" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5-5-4 4-2-2-5 5" />
    </svg>
  );
}

export const COMPOSER_LIKE_EMOJI = "👍";

type LikeSendButtonProps = {
  disabled?: boolean;
  onSend: () => void;
};

export function LikeSendButton({ disabled, onSend }: LikeSendButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Gửi like"
      title="Like"
      onClick={onSend}
      className="icon-btn shrink-0 text-lg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {COMPOSER_LIKE_EMOJI}
    </button>
  );
}
