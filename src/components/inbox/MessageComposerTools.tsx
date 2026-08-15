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

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="icon-btn"
        aria-label="Chèn emoji"
        title="Emoji"
      >
        😊
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-20 mb-2 grid w-56 grid-cols-6 gap-1 rounded-xl border border-border bg-surface p-2 shadow-elevated">
          {COMPOSER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md p-1.5 text-lg hover:bg-surface-muted"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
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
