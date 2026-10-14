import type { SourcePlatform } from "../../data/models";

/** Query parameters that only track the share, never identify the content. */
const TRACKING = [/^utm_/i, /^igsh(id)?$/i, /^fbclid$/i, /^gclid$/i, /^si$/i, /^feature$/i, /^pp$/i, /^_r$/i, /^_t$/i, /^ref(_src)?$/i, /^share_/i, /^is_from_webapp$/i, /^sender_device$/i, /^mc_(cid|eid)$/i, /^spm$/i];

function hostOf(u: URL): string {
  return u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
}

/** First http(s) link inside shared text ("Bu tarife bak https://vm.tiktok.com/x/ 😋"). */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"'“”]+/i);
  if (m) return m[0].replace(/[).,;!?…]+$/, "");
  const bare = text.match(/\b(?:www\.)?(?:instagram\.com|youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com)\/[^\s<>"']+/i);
  return bare ? `https://${bare[0].replace(/[).,;!?…]+$/, "")}` : null;
}

/** Parse a user-typed link; adds https:// for bare domains. Null when it is not a web link. */
export function parseUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(t) ? `https://${t}` : t;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u;
  } catch {
    return null;
  }
}

export function detectPlatform(raw: string): SourcePlatform | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const host = hostOf(u);
  if (host === "instagram.com" || host === "instagr.am") return "instagram";
  if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com" || host === "youtube-nocookie.com") return "youtube";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  return "web";
}

/** YouTube video id from watch, shorts, youtu.be, embed and live links. */
export function youtubeId(raw: string): string | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const host = hostOf(u);
  const valid = (id: string | null | undefined) => (id && /^[\w-]{6,20}$/.test(id) ? id : null);
  if (host === "youtu.be") return valid(u.pathname.split("/")[1]);
  if (u.pathname === "/watch") return valid(u.searchParams.get("v"));
  const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]+)/);
  return m ? valid(m[2]) : null;
}

/**
 * Canonical form of a link: https, no tracking parameters or fragments,
 * one shape per platform (instagram.com/reel/<id>/, youtube.com/shorts/<id> or
 * /watch?v=<id>, tiktok.com/@user/video/<id>). Returns null for non-links.
 */
export function normalizeUrl(raw: string): string | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const platform = detectPlatform(u.toString());
  u.protocol = "https:";
  u.hash = "";
  u.username = "";
  u.password = "";
  const host = hostOf(u);

  if (platform === "instagram") {
    const m = u.pathname.match(/^\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/);
    if (m) return `https://www.instagram.com/${m[1] === "p" ? "p" : m[1] === "tv" ? "tv" : "reel"}/${m[2]}/`;
    return `https://www.instagram.com${u.pathname}`;
  }
  if (platform === "youtube") {
    const id = youtubeId(u.toString());
    if (id) return u.pathname.startsWith("/shorts/") ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
  }
  if (platform === "tiktok") {
    const path = u.pathname.replace(/\/+$/, "");
    return host === "tiktok.com" ? `https://www.tiktok.com${path}` : `https://${host}${path}/`;
  }

  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING.some((re) => re.test(key))) u.searchParams.delete(key);
  }
  u.hostname = u.hostname.toLowerCase();
  const s = u.toString();
  return s.endsWith("?") ? s.slice(0, -1) : s;
}
