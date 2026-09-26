"use client";

import { useState } from "react";
import { personInitials } from "@/components/inbox/CustomerAvatar";

const SIZE_CLASS = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-20 w-20 text-lg",
} as const;

export function StaffAvatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(avatarUrl) && !broken;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local /api/uploads or Google CDN
      <img
        src={avatarUrl!}
        alt=""
        title={name}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`inline-flex shrink-0 rounded-full object-cover ring-2 ring-white ${SIZE_CLASS[size]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`brand-mark inline-flex shrink-0 ${SIZE_CLASS[size]} ${className}`}
      title={name}
      aria-hidden="true"
    >
      {personInitials(name)}
    </span>
  );
}
