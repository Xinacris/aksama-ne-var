import { getJson, s, type SourceAdapter } from "./types";

/** TikTok's public oEmbed: `title` is the caption. No page scraping, no video. */
export const tiktokAdapter: SourceAdapter = {
  platform: "tiktok",
  async fetchSource(url, ctx) {
    const data = await getJson(ctx, `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, "tiktok");
    const caption = s(data.title);
    const handle = s(data.author_unique_id);
    return {
      platform: "tiktok",
      url,
      title: caption ? caption.split("\n")[0] : null,
      text: caption,
      author: handle ? `@${handle.replace(/^@/, "")}` : s(data.author_name),
      thumbnailUrl: s(data.thumbnail_url),
      needsPaste: !caption,
    };
  },
};
