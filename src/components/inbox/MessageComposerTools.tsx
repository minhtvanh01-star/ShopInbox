"use client";

import { useEffect, useRef, useState } from "react";

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
        😊
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
};

export function ImagePickerButton({ disabled, onFile }: ImagePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="icon-btn"
        aria-label="Gửi ảnh"
        title="Gửi ảnh"
      >
        🖼️
      </button>
    </>
  );
}
