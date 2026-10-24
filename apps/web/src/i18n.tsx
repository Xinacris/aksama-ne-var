"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { detectLocale, getLocale, i18n, isLocale, LOCALE_STORAGE_KEY, setLocale, t, type Locale } from "@anv/core/i18n";
import { useApp } from "@/store/app";

function storedLocale(): Locale | null {
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Language: the person's own choice (saved on their user row), else this
 * browser's last choice, else the browser language (tr → Turkish, anything
 * else → English). The server renders Turkish; the switch happens before the
 * store has booted, behind the loading screen. Changing language remounts the
 * tree so memoised copy is rebuilt; `<html lang>` follows.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Locale>(getLocale());
  const meLocale = useApp((s) => s.me?.locale);

  useEffect(() => {
    const on = (l: string) => {
      if (!isLocale(l)) return;
      setLang(l);
      document.documentElement.lang = l;
    };
    i18n.on("languageChanged", on);
    setLocale(storedLocale() ?? detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]));
    on(i18n.language);
    return () => i18n.off("languageChanged", on);
  }, []);

  useEffect(() => {
    if (meLocale) setLocale(meLocale);
  }, [meLocale]);

  return (
    <I18nextProvider i18n={i18n}>
      <DocumentTitle lang={lang} />
      <Fragment key={lang}>{children}</Fragment>
    </I18nextProvider>
  );
}

/**
 * The tab title and description follow the language (React hoists them into <head>). The root
 * layout has no static title, so nothing puts the Turkish one back after a navigation.
 */
function DocumentTitle({ lang }: { lang: Locale }) {
  void lang;
  return (
    <>
      <title>{t("app.name")}</title>
      <meta name="description" content={t("app.description")} />
    </>
  );
}

/** Ayarlar › Dil: applies at once, remembered for this browser and on the user. */
export function useSetLanguage() {
  const me = useApp((s) => s.me);
  const updateProfile = useApp((s) => s.updateProfile);
  return (l: Locale) => {
    setLocale(l);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      // private mode: the choice still applies for this page
    }
    if (me && me.locale !== l) void updateProfile({ locale: l });
  };
}
