"use client";

import { getLocale, LOCALES, t } from "@anv/core/i18n";
import { useSetLanguage } from "@/i18n";
import s from "@/app/(app)/ayarlar/page.module.css";
import { DishChip } from "./ui/Chip";

/** Ayarlar › "Dil / Language": each language in its own name, applies at once. */
export function LanguageSetting() {
  const setLanguage = useSetLanguage();
  const current = getLocale();
  return (
    <section className={s.card} aria-labelledby="a-dil">
      <h2 id="a-dil" className={s.cardTitle}>
        {t("ayarlar.language")}
      </h2>
      <div className={s.chips} role="group" aria-labelledby="a-dil">
        {LOCALES.map((l) => (
          <DishChip key={l} selected={current === l} onClick={() => setLanguage(l)}>
            <span lang={l}>{t(`language.${l}`)}</span>
          </DishChip>
        ))}
      </div>
      <p className={s.note}>{t("ayarlar.languageNote")}</p>
    </section>
  );
}
