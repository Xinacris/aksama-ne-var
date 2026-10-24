"use client";

import { t } from "@anv/core/i18n";
import Link from "next/link";
import { useState } from "react";
import { IconChevronLeft, IconChevronRight, IconSnowflake } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Board, type BoardHandlers } from "@/components/week/Board";
import { DayList } from "@/components/week/DayList";
import { DayDialog, DayPicker, RecipePicker, SlotDialog } from "@/components/week/Dialogs";
import { useWeek, type DayModel } from "@/components/week/useWeek";
import type { Match, Recipe, Slot } from "@anv/core/data/models";
import { DESKTOP, useMediaQuery } from "@/hooks/useMediaQuery";
import { usePeople } from "@/hooks/usePeople";
import { numberAccusative } from "@anv/core/lib/text";
import { useApp } from "@/store/app";
import s from "./page.module.css";

export default function HaftaPage() {
  const [offset, setOffset] = useState(0);
  const week = useWeek(offset);
  const desktop = useMediaQuery(DESKTOP);
  const me = useApp((x) => x.me);
  const { partner } = usePeople();
  const [pick, setPick] = useState<{ date: string; slot: Slot } | null>(null);
  const [place, setPlace] = useState<{ recipe: Recipe; match?: Match; leftover?: { fromDate: string; useBy: string } } | null>(null);
  const [tile, setTile] = useState<{ itemId: string; date: string; slot: Slot; recipe: Recipe | null } | null>(null);
  const [day, setDay] = useState<DayModel | null>(null);

  const handlers: BoardHandlers = {
    onAdd: (date, slot) => setPick({ date, slot }),
    onTile: (itemId, date, slot, recipe) => setTile({ itemId, date, slot, recipe }),
    onDay: (d) => setDay(d),
    onPlace: (recipe, match) => setPlace({ recipe, match }),
  };

  const eyebrow = offset === 0 ? t("hafta.window") : offset < 0 ? t("hafta.weeksAgo", { count: -offset }) : t("hafta.weeksLater", { count: offset });

  return (
    <main className={s.page}>
      <div className={s.top}>
        <div className={s.titles}>
          <span className={s.eyebrow}>{eyebrow}</span>
          <h1 className={s.title}>{week.range}</h1>
        </div>
        <div className={s.nav}>
          <button type="button" className={s.round} aria-label={t("hafta.prev")} onClick={() => setOffset((o) => o - 1)}>
            <IconChevronLeft size={18} />
          </button>
          <button type="button" className={s.todayBtn} onClick={() => setOffset(0)} aria-label={t("hafta.backToThisWeek")}>
            {t("hafta.today")}
          </button>
          <button type="button" className={s.round} aria-label={t("hafta.next")} onClick={() => setOffset((o) => o + 1)}>
            <IconChevronRight size={18} />
          </button>
        </div>
      </div>

      <section aria-label={t("hafta.summary")} className={s.summary}>
        <div className={s.sumCard}>
          <span className={s.sumLabel}>{t("hafta.evenings")}</span>
          <span className={s.sumValue}>{t("hafta.planned", { count: week.summary.planned })}</span>
          <span className={s.sumNote}>{week.summary.note}</span>
        </div>
        <Link href="/liste" className={s.sumCard}>
          <span className={s.sumLabel}>{t("hafta.list")}</span>
          <span className={s.sumValue}>{t("hafta.items", { count: week.list.total })}</span>
          <span className={s.sumNote}>
            {partner && week.list.partnerBought > 0 && (
              <>
                <Avatar person={partner} size={20} />
                {t("hafta.partnerBought", { name: partner.name, count: week.list.partnerBought, nAcc: numberAccusative(week.list.partnerBought) })}
              </>
            )}
            {t("hafta.split", { pazar: week.list.pazar, market: week.list.market })}
          </span>
        </Link>
        <div className={s.sumCard} style={{ gap: 8 }}>
          <span className={s.sumLabel}>
            <IconSnowflake size={15} strokeWidth={2} />
            {t("hafta.freezer")}
          </span>
          {week.freezer.length ? (
            <ul className={s.freezer}>
              {week.freezer.map((f) => (
                <li key={f.taskId} className={f.done ? s.freezerDone : undefined}>
                  <span>{f.text}</span>
                  <span className={s.who}>
                    {f.who}
                    {f.done ? " ✓" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className={s.sumNote}>{t("hafta.freezerNone")}</span>
          )}
        </div>
      </section>

      <div className={s.boardWrap}>
        {desktop ? (
          <Board days={week.days} matches={week.matches} frequent={week.frequent} fridge={week.fridge} handlers={handlers} />
        ) : (
          <DayList days={week.days} matches={week.matches} frequent={week.frequent} handlers={handlers} fridge={week.fridge}
            onPlace={(recipe, match) => setPlace({ recipe, match })}
            onPlaceLeftover={(f) => f.outcome.kind === "fridge" && setPlace({ recipe: f.recipe, leftover: { fromDate: f.fromDate, useBy: f.outcome.useBy } })}
          />
        )}
      </div>

      <RecipePicker target={pick} onClose={() => setPick(null)} matches={week.matches} frequent={week.frequent} />
      <DayPicker target={place} onClose={() => setPlace(null)} />
      <SlotDialog
        target={tile}
        onClose={() => setTile(null)}
        onReplace={(date, slot) => {
          setTile(null);
          setPick({ date, slot });
        }}
      />
      <DayDialog
        target={
          day
            ? {
                date: day.date,
                hasMain: !!day.menu.ana,
                leftover: day.leftover && !day.isPast ? { choice: day.leftover.choice, kind: day.leftover.outcome.kind } : null,
                ateOut: day.ateOut,
                approved: !!me && day.approvals.includes(me.id),
                filled: day.filled,
              }
            : null
        }
        onClose={() => setDay(null)}
      />
    </main>
  );
}
