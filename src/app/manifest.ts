import type { MetadataRoute } from "next";

/**
 * Minimal PWA manifest. `share_target` lets Android share a Reel/Short/TikTok
 * link straight into the import screen (iOS Safari has no share targets;
 * iOS users paste the link).
 */
export default function manifest(): MetadataRoute.Manifest & { share_target: Record<string, unknown> } {
  return {
    name: "Akşama ne var?",
    short_name: "Akşama ne var",
    description: "Akşam yemeğine birlikte karar verin: eşleşme, haftalık plan, ortak alışveriş listesi.",
    lang: "tr",
    start_url: "/bugun",
    scope: "/",
    display: "standalone",
    background_color: "#F4ECDF",
    theme_color: "#F4ECDF",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    share_target: {
      action: "/tarifler/ice-aktar",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
