"use client";

import { t } from "@anv/core/i18n";
import { useSyncExternalStore } from "react";
import { preferences } from "@/data/preferences";
import { DishChip } from "./ui/Chip";
import s from "@/app/(app)/ayarlar/page.module.css";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Ayarlar › Pişirme: "Zamanlayıcı sesi" on/off (device-level, default on). */
export function TimerSoundSetting() {
  // Server render shows the default; the stored choice appears after hydration.
  const on = useSyncExternalStore(subscribe, () => preferences.getTimerSound(), () => true);
  const set = (v: boolean) => {
    preferences.setTimerSound(v);
    listeners.forEach((l) => l());
  };
  return (
    <section className={s.card} aria-labelledby="a-pisirme">
      <h2 id="a-pisirme" className={s.cardTitle}>
        {t("ayarlar.cooking")}
      </h2>
      <div className={s.chips} role="group" aria-label={t("ayarlar.timerSound")}>
        <span className={s.note} style={{ alignSelf: "center", marginRight: 4 }}>
          {t("ayarlar.timerSound")}
        </span>
        <DishChip selected={on} onClick={() => set(true)}>
          {t("ayarlar.on")}
        </DishChip>
        <DishChip selected={!on} onClick={() => set(false)}>
          {t("ayarlar.off")}
        </DishChip>
      </div>
      <p className={s.note}>{t("ayarlar.timerSoundNote")}</p>
    </section>
  );
}
