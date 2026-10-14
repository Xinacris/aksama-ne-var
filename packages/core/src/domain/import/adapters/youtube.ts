import { youtubeId } from "../detect";
import { getJson, s, SourceUnavailableError, type SourceAdapter } from "./types";

/**
 * YouTube: with `YOUTUBE_API_KEY`, the Data API v3 gives the full description
 * (where recipes usually are); without it, public oEmbed gives the title only.
 */
export const youtubeAdapter: SourceAdapter = {
  platform: "youtube",
  async fetchSource(url, ctx) {
    const id = youtubeId(url);
    const key = ctx.env.YOUTUBE_API_KEY;
    if (id && key) {
      const data = await getJson(ctx, `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`, "youtube");
      const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
      const snippet = (items[0]?.snippet ?? null) as Record<string, unknown> | null;
      if (!snippet) throw new SourceUnavailableError("youtube", "video not found");
      const thumbs = (snippet.thumbnails ?? {}) as Record<string, { url?: string }>;
      const title = s(snippet.title);
      const description = s(snippet.description);
      return {
        platform: "youtube",
        url,
        title,
        text: [title, description].filter(Boolean).join("\n\n") || null,
        author: s(snippet.channelTitle),
        thumbnailUrl: s(thumbs.high?.url) ?? s(thumbs.medium?.url) ?? s(thumbs.default?.url),
        needsPaste: !description,
      };
    }
    const data = await getJson(ctx, `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, "youtube");
    const title = s(data.title);
    return {
      platform: "youtube",
      url,
      title,
      text: title,
      author: s(data.author_name),
      thumbnailUrl: s(data.thumbnail_url),
      needsPaste: true,
    };
  },
};
