import { emptySource, type SourceAdapter } from "./types";

/**
 * Instagram: Meta's oEmbed no longer returns the caption or thumbnail and we
 * do not scrape, so the link becomes a card and the user pastes the caption.
 */
export const instagramAdapter: SourceAdapter = {
  platform: "instagram",
  async fetchSource(url) {
    const handle = url.match(/instagram\.com\/([\w.]+)\/(?:reel|p)\//)?.[1];
    return { ...emptySource("instagram", url), author: handle ? `@${handle}` : null };
  },
};
