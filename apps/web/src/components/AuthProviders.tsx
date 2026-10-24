"use client";

import { t } from "@anv/core/i18n";
import { AUTH_PROVIDERS, authProvidersUi, type AuthProvider } from "@anv/core/lib/flags";
import s from "./AuthProviders.module.css";

/** Read once at build time (NEXT_PUBLIC_AUTH_PROVIDERS_UI=0 hides the buttons). */
export const SHOW_AUTH_PROVIDERS = authProvidersUi(process.env.NEXT_PUBLIC_AUTH_PROVIDERS_UI);

/** Generic marks (no brand logos): a person for the account providers, an envelope for e-posta. */
function Mark({ provider }: { provider: AuthProvider }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {provider === "email" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </>
      ) : (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      )}
    </svg>
  );
}

/**
 * Welcome screens: "Google / Apple / E-posta ile giriş yap" — not wired to any provider yet, shown
 * as "Yakında" (focusable, announced as unavailable) behind one flag. The local flow stays below.
 */
export function AuthProviders() {
  if (!SHOW_AUTH_PROVIDERS) return null;
  return (
    <section className={s.providers} aria-label={t("auth.providers.region")} data-testid="auth-providers">
      {AUTH_PROVIDERS.map((p) => {
        const name = t(`auth.providers.${p}`);
        return (
          <button key={p} type="button" className={s.provider} aria-disabled="true" aria-label={t("auth.providers.soonLabel", { name })} onClick={(e) => e.preventDefault()}>
            <Mark provider={p} />
            <span className={s.name}>{name}</span>
            <span className={s.soon} aria-hidden="true">
              {t("auth.providers.soon")}
            </span>
          </button>
        );
      })}
      <p className={s.note}>{t("auth.providers.note")}</p>
    </section>
  );
}
