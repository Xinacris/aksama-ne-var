import { getLocales } from "expo-localization";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { I18nextProvider, setI18n } from "react-i18next";
import type { KeyValueStore } from "@anv/core/data/storage";
import { detectLocale, getLocale, i18n, isLocale, LOCALE_STORAGE_KEY, setLocale, type Locale } from "@anv/core/i18n";
import { useApp } from "./store";

setI18n(i18n);

/** First run: the phone's language (tr → Turkish, else English); later the saved choice. */
export function initialLocale(store: KeyValueStore | null): Locale {
  const saved = store?.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale(getLocales().map((l) => l.languageTag));
}

/** Same rules as the web: the person's choice wins; a language change remounts the tree. */
export function LocaleProvider({ store, children }: { store: KeyValueStore | null; children: ReactNode }) {
  const [lang, setLang] = useState<Locale>(() => {
    setLocale(initialLocale(store));
    return getLocale();
  });
  const meLocale = useApp((s) => s.me?.locale);
  useEffect(() => {
    const on = (l: string) => isLocale(l) && setLang(l);
    i18n.on("languageChanged", on);
    return () => i18n.off("languageChanged", on);
  }, []);
  useEffect(() => {
    if (meLocale) setLocale(meLocale);
  }, [meLocale]);
  return (
    <I18nextProvider i18n={i18n}>
      <Fragment key={lang}>{children}</Fragment>
    </I18nextProvider>
  );
}

/** Ayarlar › Dil: applies at once, saved on the phone and on the user. */
export function useSetLanguage(store: KeyValueStore | null) {
  const me = useApp((s) => s.me);
  const updateProfile = useApp((s) => s.updateProfile);
  return (l: Locale) => {
    setLocale(l);
    store?.setItem(LOCALE_STORAGE_KEY, l);
    if (me && me.locale !== l) void updateProfile({ locale: l });
  };
}
