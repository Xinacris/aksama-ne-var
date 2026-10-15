import { clearSharedPayloads, getSharedPayloads } from "expo-sharing";
import { importRouteFor, isSharePath } from "@/share/incoming";

/** Expo Router asks this before opening any deep link: shares go to the import screen. */
export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string> {
  if (!isSharePath(path)) return path;
  try {
    const route = importRouteFor(getSharedPayloads());
    clearSharedPayloads();
    return route;
  } catch {
    return "/tarifler/ice-aktar";
  }
}
