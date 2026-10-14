"use client";

import { useMemo } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ActivityLine, EmptyState } from "@/components/ui/Misc";
import { viewActivity } from "@anv/core/domain/activity";
import { addDays, longDate, toIsoDate } from "@anv/core/domain/dates";
import { usePeople } from "@/hooks/usePeople";
import { now } from "@anv/core/lib/clock";
import { recipesMap, useApp, usersMap } from "@/store/app";
import s from "../ayarlar/page.module.css";

export default function AkisPage() {
  const activity = useApp((x) => x.activity);
  const recipes = useApp((x) => x.recipes);
  const people = useApp((x) => x.people);
  const today = useApp((x) => x.today);
  const { byId } = usePeople();

  const groups = useMemo(() => {
    const users = usersMap(people);
    const out: { label: string; items: ReturnType<typeof viewActivity>[] }[] = [];
    for (const a of activity) {
      const day = toIsoDate(new Date(a.createdAt));
      const label = day === today ? "Bugün" : day === addDays(today, -1) ? "Dün" : longDate(day);
      const v = viewActivity(a, { recipesById: recipesMap(recipes), users, todayIso: today, now: now() });
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(v);
      else out.push({ label, items: [v] });
    }
    return out;
  }, [activity, recipes, people, today]);

  return (
    <main className={s.page}>
      <h1 className={s.title}>Evde neler oldu</h1>
      {groups.length === 0 ? (
        <EmptyState
          title="Henüz sessiz"
          text="Plana yemek eklendikçe, eşleştikçe ve alışveriş yapıldıkça burada birikir."
          actions={
            <ButtonLink href="/eslesme" size="sm">
              Kaydırmaya başla
            </ButtonLink>
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.label} className={s.card} aria-label={g.label}>
            <h2 className={s.cardTitle}>{g.label}</h2>
            <ul className={s.members}>
              {g.items.map((v) => {
                const p = byId.get(v.actorId) ?? { name: v.actorName, initial: v.actorName[0] ?? "?", color: "#685846" };
                return (
                  <li key={v.id}>
                    <ActivityLine person={p} text={v.text} when={v.when} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
