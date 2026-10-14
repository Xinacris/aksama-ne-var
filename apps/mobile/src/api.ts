import { getLocale } from "@anv/core/i18n";

/** The web app hosts /api/import and /api/translate; phones call it over HTTPS. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://aksama-ne-var.vercel.app").replace(/\/$/, "");

export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "accept-language": getLocale() },
    body: JSON.stringify(body),
    signal,
  });
  let json: T;
  try {
    json = (await res.json()) as T;
  } catch {
    json = {} as T;
  }
  return { ok: res.ok, status: res.status, body: json };
}
