/**
 * Feature flags. One switch per feature, read from the platform's public env at build time
 * (web: `NEXT_PUBLIC_*`, phone: `EXPO_PUBLIC_*`), so both apps decide the same way.
 */

/**
 * Sign-in provider buttons on the welcome screens (Google, Apple, e-posta): UI only, shown as
 * "Yakında" until real accounts exist. On unless the env says 0 / false / off / no.
 * Web: NEXT_PUBLIC_AUTH_PROVIDERS_UI · phone: EXPO_PUBLIC_AUTH_PROVIDERS_UI.
 */
export function authProvidersUi(raw: string | undefined): boolean {
  return !/^(0|false|off|no)$/i.test((raw ?? "").trim());
}

export const AUTH_PROVIDERS = ["google", "apple", "email"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];
