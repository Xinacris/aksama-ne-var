"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@anv/core/data/models";
import { hasLocaleText } from "@anv/core/domain/recipeText";
import { getLocale, t } from "@anv/core/i18n";
import { requestTranslation, translateAvailable, type FetchLike } from "@anv/core/services/translate";
import { useApp } from "@/store/app";
import { Button } from "./ui/Button";
import s from "@/app/(app)/tarif/[id]/page.module.css";

/**
 * "Çevir / Translate" under a household recipe written in the other language.
 * Hidden when the server has no provider (no API key) — never a broken button.
 */
export function TranslateAction({ raw }: { raw: Recipe }) {
  const household = useApp((x) => x.household);
  const saveTranslation = useApp((x) => x.saveTranslation);
  const setNotice = useApp((x) => x.setNotice);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const locale = getLocale();
  const needed = raw.householdId !== null && !hasLocaleText(raw, locale);

  useEffect(() => {
    if (!needed) return;
    let alive = true;
    void translateAvailable(fetch as unknown as FetchLike).then((a) => alive && setAvailable(a));
    return () => {
      alive = false;
    };
  }, [needed]);

  if (!needed || !available) return null;
  return (
    <div className={s.translate} role="note">
      <span>{t("translate.note", { lang: t(`language.in.${raw.lang ?? "tr"}`) })}</span>
      <Button
        size="sm"
        variant="soft"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const out = await requestTranslation(fetch as unknown as FetchLike, "", raw, locale, household?.id ?? "");
          if (out.ok) {
            await saveTranslation(raw.id, locale, out.translation);
            setNotice({ kind: "info", text: t("translate.done") });
          } else setNotice({ kind: "error", text: out.error ?? t("translate.failed") });
          setBusy(false);
        }}
      >
        {busy ? t("translate.working") : t("translate.action")}
      </Button>
    </div>
  );
}
