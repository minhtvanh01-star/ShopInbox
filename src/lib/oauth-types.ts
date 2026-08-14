import type { Channel } from "./types";

export type MetaPageOption = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramId?: string;
  instagramUsername?: string;
};

export type PendingMetaPages = {
  channel: Channel;
  pages: MetaPageOption[];
};
