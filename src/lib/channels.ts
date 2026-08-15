import type { Channel } from "./types";

export const CHANNEL_ACCENT: Record<Channel, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  zalo: "#0068FF",
  web: "#0D9488",
};

export type PlatformAvailability = "available" | "beta" | "coming";

export type CredentialField = {
  key: "appId" | "appSecret" | "pageId" | "webhookSecret" | "oaId";
  label: string;
  placeholder: string;
  required?: boolean;
};

export type PlatformOption = {
  id: string;
  channel?: Channel;
  name: string;
  description: string;
  availability: PlatformAvailability;
  accent: string;
  oauth?: boolean;
  fields: CredentialField[];
};

export const PLATFORM_AVAILABILITY_LABEL: Record<PlatformAvailability, string> = {
  available: "",
  beta: "Beta",
  coming: "Sắp có",
};

export const CONNECT_PLATFORMS: PlatformOption[] = [
  {
    id: "facebook",
    channel: "facebook",
    name: "Facebook Messenger",
    description: "Tin nhắn Fanpage qua Meta Graph API",
    availability: "available",
    accent: "#1877F2",
    oauth: true,
    fields: [
      { key: "appId", label: "App ID", placeholder: "123456789012345", required: true },
      { key: "appSecret", label: "App Secret", placeholder: "abc...", required: true },
      { key: "pageId", label: "Page ID", placeholder: "987654321098765", required: true },
      {
        key: "webhookSecret",
        label: "Webhook Verify Token",
        placeholder: "token-xac-minh-webhook",
        required: true,
      },
    ],
  },
  {
    id: "instagram",
    channel: "instagram",
    name: "Instagram DM",
    description: "Tin nhắn trực tiếp — dùng chung Meta app",
    availability: "available",
    accent: "#E1306C",
    oauth: true,
    fields: [
      { key: "appId", label: "App ID (Meta)", placeholder: "123456789012345", required: true },
      { key: "appSecret", label: "App Secret", placeholder: "abc...", required: true },
      { key: "pageId", label: "Instagram Business Account ID", placeholder: "178414...", required: true },
      {
        key: "webhookSecret",
        label: "Webhook Verify Token",
        placeholder: "token-xac-minh-webhook",
        required: true,
      },
    ],
  },
  {
    id: "zalo",
    channel: "zalo",
    name: "Zalo OA",
    description: "Official Account — Zalo OA API",
    availability: "available",
    accent: "#0068FF",
    oauth: true,
    fields: [
      { key: "appId", label: "App ID", placeholder: "1234567890", required: true },
      { key: "appSecret", label: "Secret Key", placeholder: "abc...", required: true },
      { key: "oaId", label: "OA ID", placeholder: "1234567890123456789", required: true },
      {
        key: "webhookSecret",
        label: "Webhook Secret / Verify Token",
        placeholder: "token-webhook-zalo",
        required: true,
      },
    ],
  },
  {
    id: "web",
    channel: "web",
    name: "Chat website",
    description: "Widget chat trên website — không cần duyệt MXH",
    availability: "available",
    accent: "#0D9488",
    fields: [
      {
        key: "pageId",
        label: "Domain website",
        placeholder: "https://cuahang.vn",
        required: true,
      },
      {
        key: "webhookSecret",
        label: "Widget key (tùy chọn)",
        placeholder: "key-noi-bo-widget",
      },
    ],
  },
  {
    id: "threads",
    name: "Threads",
    description: "Đang trong lộ trình tích hợp",
    availability: "coming",
    accent: "#000000",
    fields: [],
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Chưa mở — cần đối tác Business API",
    availability: "coming",
    accent: "#010101",
    fields: [],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Beta — qua Meta Cloud API",
    availability: "beta",
    accent: "#25D366",
    fields: [],
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Sắp có — Bot API",
    availability: "coming",
    accent: "#0088CC",
    fields: [],
  },
  {
    id: "booking",
    name: "Booking.com",
    description: "Sắp có — kênh đặt phòng",
    availability: "coming",
    accent: "#003580",
    fields: [],
  },
  {
    id: "airbnb",
    name: "Airbnb",
    description: "Sắp có — tin nhắn khách lưu trú",
    availability: "coming",
    accent: "#FF5A5F",
    fields: [],
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Sắp có — bình luận / tin nhắn",
    availability: "coming",
    accent: "#FF0000",
    fields: [],
  },
  {
    id: "shopee",
    name: "Shopee Chat",
    description: "Sắp có — Open Platform",
    availability: "coming",
    accent: "#EE4D2D",
    fields: [],
  },
];

export function getPlatformById(id: string) {
  return CONNECT_PLATFORMS.find((platform) => platform.id === id);
}

export function channelHasCredentials(
  channel: Channel,
  data: {
    appId?: string | null;
    appSecret?: string | null;
    pageId?: string | null;
    webhookSecret?: string | null;
    oaId?: string | null;
    accessToken?: string | null;
    displayName?: string | null;
  },
) {
  // Chat website: chỉ cần domain (chưa có OAuth token).
  if (channel === "web") {
    const platform = CONNECT_PLATFORMS.find((item) => item.channel === channel);
    if (!platform || platform.fields.length === 0) {
      return false;
    }
    return platform.fields
      .filter((field) => field.required)
      .every((field) => {
        const value = data[field.key];
        return typeof value === "string" && value.trim().length > 0;
      });
  }

  // Facebook / Instagram / Zalo: App ID/Secret không đủ để gửi tin — cần access token (OAuth).
  const token = data.accessToken?.trim();
  if (!token) {
    return false;
  }

  if (channel === "zalo") {
    return Boolean(data.oaId?.trim() || data.displayName?.trim());
  }

  return Boolean(data.pageId?.trim() || data.displayName?.trim());
}
