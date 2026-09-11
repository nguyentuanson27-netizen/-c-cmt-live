import type { Platform } from "../platform";

export type Comment = {
  id: string;
  platform: Platform;
  sourceId: string;
  sourceLabel?: string;
  username: string;
  text: string;
  receivedAt: number;
};
