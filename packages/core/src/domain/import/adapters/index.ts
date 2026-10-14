import type { SourcePlatform } from "../../../data/models";
import { instagramAdapter } from "./instagram";
import { tiktokAdapter } from "./tiktok";
import type { SourceAdapter } from "./types";
import { webAdapter } from "./web";
import { youtubeAdapter } from "./youtube";

export * from "./types";

/** One adapter per platform. Add a source by writing an adapter and listing it here. */
export const ADAPTERS: Record<SourcePlatform, SourceAdapter> = {
  instagram: instagramAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
  web: webAdapter,
};
