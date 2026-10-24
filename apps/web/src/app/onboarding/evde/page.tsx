"use client";

import { t } from "@anv/core/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Guard, Loading } from "@/components/Guard";
import { IconArrowRight } from "@/components/icons";
import { PantryQuickAdd } from "@/components/pantry/Pantry";
import { SimpleShell } from "@/components/SimpleShell";
import { useApp } from "@/store/app";
import s from "../onboarding.module.css";

/** Onboarding: "Evde neler var?" — a few taps, or skip. */
function StepPantry() {
  const router = useRouter();
  const last = useSearchParams().get("son") === "1";
  const status = useApp((st) => st.status);
  const pantry = useApp((st) => st.pantry);
  const addPantryItems = useApp((st) => st.addPantryItems);
  const completeOnboarding = useApp((st) => st.completeOnboarding);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const initial = useMemo(() => pantry.map((p) => p.name), [pantry]);
  const chosen = picked ?? initial;

  if (status !== "ready") return <Loading />;

  const toggle = (n: string) => setPicked(chosen.includes(n) ? chosen.filter((x) => x !== n) : [...chosen, n]);

  async function next(save: boolean) {
    setBusy(true);
    if (save) await addPantryItems(chosen.filter((n) => !initial.includes(n)).map((name) => ({ name })));
    if (last) {
      await completeOnboarding();
      router.push("/bugun");
    } else router.push("/onboarding/2");
  }

  return (
    <SimpleShell aside={t(last ? "onbPantry.step22" : "onbPantry.step23")}>
      <main className={s.main1}>
        <div className={s.intro}>
          <h1 className={s.title}>{t("onbPantry.title")}</h1>
          <p className={s.lead}>{t("onbPantry.lead")}</p>
        </div>
        <PantryQuickAdd isOn={(n) => chosen.includes(n)} onToggle={toggle} onAdd={(n) => !chosen.includes(n) && setPicked([...chosen, n])} />
      </main>
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span className={s.count} role="status">
            <strong>{t("onbPantry.chosen", { count: chosen.length })}</strong>
          </span>
          <div className={s.footerActions}>
            <button type="button" className={s.skip} onClick={() => void next(false)} disabled={busy}>
              {t("onbPantry.skip")}
            </button>
            <button type="button" className={s.continue} onClick={() => void next(true)} disabled={busy}>
              {t(last ? "onbPantry.letsStart" : "onbPantry.continue")}
              <IconArrowRight size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </footer>
    </SimpleShell>
  );
}

export default function OnboardingPantry() {
  return (
    <Guard need="household">
      <Suspense fallback={<Loading />}>
        <StepPantry />
      </Suspense>
    </Guard>
  );
}
