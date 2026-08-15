import type { Channel } from "./types";

export type MetaPageOption = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramId?: string;
  instagramUsername?: string;
};

/** Payload gửi xuống client — không kèm page access token. */
export type MetaPagePickerOption = {
  pageId: string;
  pageName: string;
  instagramId?: string;
  instagramUsername?: string;
};

export type PendingMetaPages = {
  channel: Channel;
  pages: MetaPagePickerOption[];
};
