"use client";

import { t } from "@anv/core/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { reminderText, type PantryReminder } from "@anv/core/domain/pantryReminders";
import { preferences } from "@/data/preferences";
import { usePantryReminders } from "@/hooks/usePantryReminders";
import { useApp } from "@/store/app";
import { IconBasket } from "../icons";
import s from "./PantryReminderBanner.module.css";

export function checkHref(r: Pick<PantryReminder, "id">): string {
  return `/evde/kontrol?r=${encodeURIComponent(r.id)}`;
}

/** Browser notification, only when the person allowed it and the tab is in the background. Never throws. */
function notify(r: PantryReminder, text: { title: string; body: string }, open: (href: string) => void): boolean {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState !== "hidden") return false;
    const n = new Notification(text.title, { body: text.body, tag: r.id });
    n.onclick = () => {
      window.focus();
      open(checkHref(r));
      n.close();
    };
    return true;
  } catch {
    // Some browsers only show notifications from a service worker: the in-app banner covers it.
    return false;
  }
}

/**
 * Web delivery of the pantry reminders: an in-app banner (always), plus a browser notification
 * when permission was granted. The phone schedules local notifications from the same plan.
 */
export function PantryReminderBanner() {
  const plan = usePantryReminders();
  const recipes = useApp((x) => x.recipes);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const names = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const hidden = dismissed ?? [];
  const due = plan.due.filter((r) => !hidden.includes(r.id));
  const top = due[0];

  useEffect(() => {
    // Read once on the client (keeps the server render and the first client render the same).
    const id = window.setTimeout(() => setDismissed(preferences.getPantryDismissed()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const run = () => {
      const done = new Set(preferences.getPantryNotified());
      for (const r of plan.due) {
        if (done.has(r.id)) continue;
        if (notify(r, reminderText(r, names), (href) => router.push(href))) preferences.markPantryNotified(r.id);
      }
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [plan.due, names, router]);

  if (!top || dismissed === null || pathname.startsWith("/evde/kontrol")) return null;
  const text = reminderText(top, names);
  return (
    <section className={s.banner} aria-label={t("pantry.banner")} data-testid="pantry-banner">
      <span className={s.icon} aria-hidden="true">
        <IconBasket size={20} />
      </span>
      <div className={s.texts}>
        <p className={s.title}>{text.title}</p>
        <p className={s.body}>{text.body}</p>
      </div>
      <div className={s.actions}>
        <Link className={s.open} href={checkHref(top)}>
          {t("pantry.bannerOpen")}
        </Link>
        <button type="button" className={s.later} onClick={() => setDismissed(preferences.dismissPantry(top.id))}>
          {t("pantry.bannerLater")}
        </button>
      </div>
    </section>
  );
}
