import { CHANNEL_ACCENT } from "@/lib/channels";
import { CHANNEL_LABEL } from "@/lib/labels";
import type { Channel } from "@/lib/types";

export function ChannelBadge({ channel }: { channel: Channel }) {
  const accent = CHANNEL_ACCENT[channel];

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: accent,
        backgroundColor: `${accent}1a`,
      }}
    >
      {CHANNEL_LABEL[channel]}
    </span>
  );
}
