"use client";

import { t } from "@anv/core/i18n";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { findReminder, reminderText, reminderNames } from "@anv/core/domain/pantryReminders";
import { PantryCheck } from "@/components/pantry/Pantry";
import { Loading } from "@/components/Guard";
import { EmptyState } from "@/components/ui/Misc";
import { usePantryReminders } from "@/hooks/usePantryReminders";
import { useApp } from "@/store/app";
import s from "../page.module.css";

/** A reminder's quick "var / yok / az kaldı" checklist (from the banner or a notification). */
function Kontrol() {
  const id = useSearchParams().get("r") ?? "";
  const plan = usePantryReminders();
  const recipes = useApp((x) => x.recipes);
  const router = useRouter();
  const names = useMemo(() => reminderNames(recipes), [recipes]);
  const answer = useApp((x) => x.answerPantryCheck);
  const r = findReminder(plan, id);
  const text = r ? reminderText(r, names) : null;
  return (
    <main className={s.page}>
      <header className={s.header}>
        <span className={s.eyebrow}>{t("pantry.checkEyebrow")}</span>
        <h1 className={s.title}>{text?.title ?? t("pantry.title")}</h1>
        {text && <p className={s.lead}>{text.body}</p>}
        {r && <p className={s.lead}>{t("pantry.checkLead")}</p>}
      </header>
      {r && r.ingredients.length === 0 ? (
        // A week check with nothing at home and nothing planned: send them to the pantry, and let them answer it.
        <section className={s.card} aria-label={t("pantry.checkEyebrow")}>
          <p className={s.lead}>{t("pantry.checkEmpty")}</p>
          <div className={s.actions}>
            <Link href="/evde" className={s.primary}>
              {t("pantry.checkOpenPantry")}
            </Link>
            <button
              type="button"
              className={s.secondary}
              onClick={async () => {
                await answer(r.answerKey, {});
                router.push("/evde");
              }}
            >
              {t("pantry.checkLooked")}
            </button>
          </div>
        </section>
      ) : r ? (
        <section className={s.card} aria-label={t("pantry.checkEyebrow")}>
          <PantryCheck ingredients={r.ingredients} answerKey={r.answerKey} onDone={() => router.push("/evde")} />
        </section>
      ) : (
        <EmptyState
          title={t("pantry.checkNothing")}
          actions={
            <Link href="/evde" className={s.back}>
              {t("pantry.checkOpenPantry")}
            </Link>
          }
        />
      )}
    </main>
  );
}

export default function KontrolPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Kontrol />
    </Suspense>
  );
}
