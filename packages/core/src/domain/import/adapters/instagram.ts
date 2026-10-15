import { emptySource, s, SourceUnavailableError, type AdapterContext, type SourceAdapter } from "./types";

/**
 * Instagram: Meta's oEmbed answers without an access token again (June 2026), for public posts
 * and reels only. Tested live on 2026-10-15: the answer's `html` is the embed blockquote with
 * only "View this post on Instagram" in it (the caption is drawn later by Meta's embed.js), and
 * no author, title or thumbnail. So the call mostly tells a public post from a private or
 * deleted one, and the user pastes the caption (or, on the phone, reads it from a screenshot).
 * If the HTML ever carries the caption again, it is used. No scraping.
 */
export const INSTAGRAM_OEMBED = "https://graph.facebook.com/v24.0/instagram_oembed";

/** Graph API errors that mean "this media can't be embedded": private account, deleted, wrong link. */
const NOT_EMBEDDABLE_SUBCODES = new Set([2207045, 2207046]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z#0-9]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Lines of the embed's paragraphs that are the post's own words (not "View this post…", "A post shared by…"). */
export function captionFromEmbedHtml(html: string | null): string | null {
  if (!html) return null;
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    decode(
      m[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/[ \t]+/g, " "),
    )
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .trim(),
  );
  const own = paragraphs.filter((p) => p && !/^(view this post on instagram|a post shared by|bu gönderiyi instagram'da gör)/i.test(p));
  const text = own.join("\n\n").trim();
  // A real caption has some substance; a handle or a date line alone isn't one.
  return text.length >= 20 ? text : null;
}

async function oembed(url: string, ctx: AdapterContext): Promise<{ availability: "public" | "private"; data: Record<string, unknown> }> {
  const endpoint = `${INSTAGRAM_OEMBED}?url=${encodeURIComponent(url)}&omitscript=true`;
  let res: Response;
  try {
    res = await ctx.fetch(endpoint, { signal: ctx.signal, headers: { accept: "application/json" } });
  } catch {
    throw new SourceUnavailableError("instagram", "unreachable");
  }
  let data: Record<string, unknown> = {};
  try {
    const body = (await res.json()) as unknown;
    if (body && typeof body === "object") data = body as Record<string, unknown>;
  } catch {
    // not JSON: judged by the status alone
  }
  if (res.ok) return { availability: "public", data };
  const err = (data.error ?? {}) as { code?: number; error_subcode?: number };
  if (err.code === 24 && err.error_subcode && NOT_EMBEDDABLE_SUBCODES.has(err.error_subcode)) return { availability: "private", data };
  // Rate limits (429, codes 4/17/32/613), Meta outages, anything else: "Instagram şu an yanıt vermedi".
  throw new SourceUnavailableError("instagram", `status ${res.status}${err.code ? ` code ${err.code}` : ""}`);
}

export const instagramAdapter: SourceAdapter = {
  platform: "instagram",
  async fetchSource(url, ctx) {
    const handle = url.match(/instagram\.com\/([\w.]+)\/(?:reels?|p)\//)?.[1] ?? null;
    const base = { ...emptySource("instagram", url), author: handle ? `@${handle}` : null };
    const { availability, data } = await oembed(url, ctx);
    if (availability === "private") return { ...base, availability };
    const author = s(data.author_name);
    const caption = captionFromEmbedHtml(s(data.html));
    return {
      ...base,
      availability,
      author: author ? `@${author.replace(/^@/, "")}` : base.author,
      thumbnailUrl: s(data.thumbnail_url),
      text: caption,
      needsPaste: !caption,
    };
  },
};
