-- Super admin chỉnh quét đồng bộ kênh (bật/tắt + khoảng phút/giây).
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "channelSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "channelSyncIntervalSec" INTEGER NOT NULL DEFAULT 240,
    "channelSyncLastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings" ("id", "channelSyncEnabled", "channelSyncIntervalSec", "updatedAt")
VALUES ('platform', true, 240, CURRENT_TIMESTAMP);
