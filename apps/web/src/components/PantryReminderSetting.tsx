"use client";

import { t } from "@anv/core/i18n";
import { useState, useSyncExternalStore } from "react";
import { useReminderSettings } from "@/hooks/usePantryReminders";
import { DishChip } from "./ui/Chip";
import s from "@/app/(app)/ayarlar/page.module.css";

type Perm = "granted" | "denied" | "default" | "unsupported";
const readPerm = (): Perm => (typeof Notification === "undefined" ? "unsupported" : (Notification.permission as Perm));
const noop = () => () => {};

/** Ayarlar › Hatırlatmalar: "Evde ne var" reminders (device-level, on by default) and browser notifications. */
export function PantryReminderSetting() {
  const [settings, set] = useReminderSettings();
  const initial = useSyncExternalStore(noop, readPerm, () => "default" as Perm);
  const [perm, setPerm] = useState<Perm | null>(null);
  const permission = perm ?? initial;

  async function ask() {
    try {
      setPerm((await Notification.requestPermission()) as Perm);
    } catch {
      setPerm("denied");
    }
  }

  const toggle = (label: string, on: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <div className={s.chips} role="group" aria-label={label}>
      <span className={s.note} style={{ alignSelf: "center", marginRight: 4 }}>
        {label}
      </span>
      <DishChip selected={on} disabled={disabled} onClick={() => onChange(true)}>
        {t("ayarlar.on")}
      </DishChip>
      <DishChip selected={!on} disabled={disabled} onClick={() => onChange(false)}>
        {t("ayarlar.off")}
      </DishChip>
    </div>
  );

  return (
    <section className={s.card} aria-labelledby="a-hatirlatma">
      <h2 id="a-hatirlatma" className={s.cardTitle}>
        {t("ayarlar.reminders")}
      </h2>
      {toggle(t("ayarlar.pantryReminders"), settings.enabled, (v) => set({ ...settings, enabled: v }))}
      <p className={s.note}>{t("ayarlar.pantryRemindersNote")}</p>
      {settings.enabled && (
        <>
          {toggle(t("ayarlar.reminderWeek"), settings.weekStart, (v) => set({ ...settings, weekStart: v }))}
          {toggle(t("ayarlar.reminderDays"), settings.pantryDays, (v) => set({ ...settings, pantryDays: v }))}
          <div className={s.chips} role="group" aria-label={t("ayarlar.browserNotif")}>
            <span className={s.note} style={{ alignSelf: "center", marginRight: 4 }}>
              {t("ayarlar.browserNotif")}
            </span>
            {permission === "default" && (
              <DishChip selected={false} onClick={() => void ask()}>
                {t("ayarlar.browserNotifAllow")}
              </DishChip>
            )}
          </div>
          <p className={s.note} role="status">
            {permission === "granted" ? t("ayarlar.browserNotifOn") : permission === "unsupported" ? t("ayarlar.browserNotifNone") : t("ayarlar.browserNotifOff")}
          </p>
        </>
      )}
    </section>
  );
}
