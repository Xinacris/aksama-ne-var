import type { SharePayload } from "expo-sharing";

/**
 * Something shared into the app from the OS share sheet (Instagram / TikTok / YouTube → "Akşama ne
 * var?") becomes the import screen, prefilled: `/tarifler/ice-aktar?text=…`. The screen pulls the
 * link out of the text itself (`extractUrl`) and starts the import, as for the web's Share Target.
 * Shares with neither text nor a link (an image) open the empty import screen.
 */
export const IMPORT_ROUTE = "/tarifler/ice-aktar";

export function importRouteFor(payloads: Pick<SharePayload, "shareType" | "value">[]): string {
  const text = payloads
    .filter((p) => (p.shareType ?? "text") === "text" || p.shareType === "url")
    .map((p) => (p.value ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!text) return IMPORT_ROUTE;
  // Captions can be long; the import takes at most 20 000 characters anyway.
  return `${IMPORT_ROUTE}?text=${encodeURIComponent(text.slice(0, 20_000))}`;
}

/** expo-sharing opens the app at `<scheme>://expo-sharing` after a share. */
export function isSharePath(path: string): boolean {
  try {
    return new URL(path, "mealplanner://app").hostname === "expo-sharing";
  } catch {
    return false;
  }
}
