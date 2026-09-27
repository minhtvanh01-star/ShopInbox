import { prisma } from "@/backend/prisma";
import { syncConnectedMetaInbox } from "@/backend/channel-connect";
import type { Channel } from "@/lib/types";

const SWEEP_CHANNELS: Channel[] = ["facebook", "instagram"];

export type ChannelSyncSweepResult = {
  skipped?: boolean;
  channels: number;
  ingested: number;
  errors: number;
};

let running = false;

export function resetChannelSyncSweepLock() {
  running = false;
}

/** Một vòng: mọi kênh FB/IG đã nối (hoặc một shop). Không đăng ký lại webhook. */
export async function runChannelSyncSweep(shopId?: string): Promise<ChannelSyncSweepResult> {
  if (running) {
    return { skipped: true, channels: 0, ingested: 0, errors: 0 };
  }
  running = true;
  try {
    const accounts = await prisma.channelAccount.findMany({
      where: {
        status: "ready",
        channel: { in: SWEEP_CHANNELS },
        accessToken: { not: null },
        shop: { suspendedAt: null },
        ...(shopId ? { shopId } : {}),
      },
      select: { shopId: true, channel: true },
      orderBy: [{ shopId: "asc" }, { channel: "asc" }],
    });

    let ingested = 0;
    let errors = 0;
    for (const account of accounts) {
      try {
        const result = await syncConnectedMetaInbox(account.shopId, account.channel, {
          registerWebhooks: false,
          updateNote: false,
        });
        ingested += result.ingested;
      } catch (error) {
        errors += 1;
        console.error("[channel-sync] pull failed", {
          shopId: account.shopId,
          channel: account.channel,
          error,
        });
      }
    }

    return { channels: accounts.length, ingested, errors };
  } finally {
    running = false;
  }
}
