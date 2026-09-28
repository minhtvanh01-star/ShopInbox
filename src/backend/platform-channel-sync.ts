import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import {
  clampChannelSyncIntervalSec,
  DEFAULT_CHANNEL_SYNC_SETTINGS,
  PLATFORM_SETTING_ID,
  type ChannelSyncSettings,
} from "@/lib/channel-sync";

function mapRow(row: {
  channelSyncEnabled: boolean;
  channelSyncIntervalSec: number;
  channelSyncLastRunAt: Date | null;
}): ChannelSyncSettings {
  return {
    enabled: row.channelSyncEnabled,
    intervalSec: clampChannelSyncIntervalSec(row.channelSyncIntervalSec),
    lastRunAt: row.channelSyncLastRunAt,
  };
}

export async function getChannelSyncSettings(): Promise<ChannelSyncSettings> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
    });
    if (!row) return DEFAULT_CHANNEL_SYNC_SETTINGS;
    return mapRow(row);
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) return DEFAULT_CHANNEL_SYNC_SETTINGS;
    throw error;
  }
}

export async function saveChannelSyncSettings(input: {
  enabled: boolean;
  intervalSec: number;
}): Promise<ChannelSyncSettings> {
  const intervalSec = clampChannelSyncIntervalSec(input.intervalSec);
  const row = await prisma.platformSetting.upsert({
    where: { id: PLATFORM_SETTING_ID },
    create: {
      id: PLATFORM_SETTING_ID,
      channelSyncEnabled: input.enabled,
      channelSyncIntervalSec: intervalSec,
    },
    update: {
      channelSyncEnabled: input.enabled,
      channelSyncIntervalSec: intervalSec,
    },
  });
  return mapRow(row);
}

export async function markChannelSyncRan(at = new Date()) {
  try {
    await prisma.platformSetting.upsert({
      where: { id: PLATFORM_SETTING_ID },
      create: {
        id: PLATFORM_SETTING_ID,
        channelSyncLastRunAt: at,
      },
      update: { channelSyncLastRunAt: at },
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) return;
    throw error;
  }
}
