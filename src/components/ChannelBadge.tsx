import { CHANNEL_LABEL } from "@/lib/labels";
import type { Channel } from "@/lib/types";

const TONE: Record<Channel, string> = {
  facebook: "bg-[#1877F2]/10 text-[#1877F2]",
  zalo: "bg-[#0068FF]/10 text-[#0068FF]",
  instagram: "bg-[#E1306C]/10 text-[#E1306C]",
  web: "bg-teal-50 text-teal-700",
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[channel]}`}
    >
      {CHANNEL_LABEL[channel]}
    </span>
  );
}
