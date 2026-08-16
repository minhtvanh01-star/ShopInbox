"use client";

import { useState } from "react";
import type { Channel } from "@/lib/types";
import { CHANNEL_ACCENT } from "@/lib/channels";

export function personInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

type CustomerAvatarProps = {
  name: string;
  channel?: Channel;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
  title?: string;
};

const SIZE_CLASS = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-10 w-10 text-xs",
} as const;

/** Avatar khách — ưu tiên URL Meta/Zalo, fallback initials + màu kênh. */
export function CustomerAvatar({
  name,
  channel,
  avatarUrl,
  size = "sm",
  className = "",
  title,
}: CustomerAvatarProps) {
  const [broken, setBroken] = useState(false);
  const accent = channel ? CHANNEL_ACCENT[channel] : "#0d9488";
  const label = personInitials(name);
  const showImage = Boolean(avatarUrl) && !broken;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- CDN Meta/Zalo đa domain
      <img
        src={avatarUrl!}
        alt=""
        title={title ?? name}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`inline-flex shrink-0 rounded-full object-cover shadow-sm ring-2 ring-white ${SIZE_CLASS[size]} ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white ${SIZE_CLASS[size]} ${className}`}
      style={{ backgroundColor: accent }}
      title={title ?? name}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
