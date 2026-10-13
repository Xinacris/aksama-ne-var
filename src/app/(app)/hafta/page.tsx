"use client";

import Link from "next/link";
import { useState } from "react";
import { IconChevronLeft, IconChevronRight, IconSnowflake } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Board, type BoardHandlers } from "@/components/week/Board";
import { DayList } from "@/components/week/DayList";
import { DayDialog, DayPicker, RecipePicker, SlotDialog } from "@/components/week/Dialogs";
import { useWeek, type DayModel } from "@/components/week/useWeek";
import type { Match, Recipe, Slot } from "@/data/models";
import { DESKTOP, useMediaQuery } from "@/hooks/useMediaQuery";
import { usePeople } from "@/hooks/usePeople";
import { numberAccusative } from "@/lib/text";
import { useApp } from "@/store/app";
import s from "./page.module.css";

export default function HaftaPage() {
  const [offset, setOffset] = useState(0);
  const week = useWeek(offset);
  const desktop = useMediaQuery(DESKTOP);
  const me = useApp((x) => x.me);
  const { partner } = usePeople();
  const [pick, setPick] = useState<{ date: string; slot: Slot } | null>(null);
  const [place, setPlace] = useState<{ recipe: Recipe; match?: Match } | null>(null);
  const [tile, setTile] = useState<{ itemId: string; date: string; slot: Slot; recipe: Recipe | null } | null>(null);
  const [day, setDay] = useState<DayModel | null>(null);

  const handlers: BoardHandlers = {
    onAdd: (date, slot) => setPick({ date, slot }),
    onTile: (itemId, date, slot, recipe) => setTile({ itemId, date, slot, recipe }),
    onDay: (d) => setDay(d),
  };

  const eyebrow = offset === 0 ? "Son iki gün ve önümüzdeki beş gün" : offset < 0 ? `${-offset} hafta önce` : `${offset} hafta sonra`;

  return (
    <main className={s.page}>
      <div className={s.top}>
        <div className={s.titles}>
          <span className={s.eyebrow}>{eyebrow}</span>
          <h1 className={s.title}>{week.range}</h1>
        </div>
        <div className={s.nav}>
          <button type="button" className={s.round} aria-label="Önceki hafta" onClick={() => setOffset((o) => o - 1)}>
            <IconChevronLeft size={18} />
          </button>
          <button type="button" className={s.todayBtn} onClick={() => setOffset(0)} aria-label="Bu haftaya dön">
            Bugün
          </button>
          <button type="button" className={s.round} aria-label="Sonraki hafta" onClick={() => setOffset((o) => o + 1)}>
            <IconChevronRight size={18} />
          </button>
        </div>
      </div>

      <section aria-label="Haftanın özeti" className={s.summary}>
        <div className={s.sumCard}>
          <span className={s.sumLabel}>Akşamlar</span>
          <span className={s.sumValue}>{week.summary.planned} akşam planlı</span>
          <span className={s.sumNote}>{week.summary.note}</span>
        </div>
        <Link href="/liste" className={s.sumCard}>
          <span className={s.sumLabel}>Alışveriş listesi</span>
          <span className={s.sumValue}>{week.list.total} ürün</span>
          <span className={s.sumNote}>
            {partner && week.list.partnerBought > 0 && (
              <>
                <Avatar person={partner} size={20} />
                {partner.name} {numberAccusative(week.list.partnerBought)} aldı ·{" "}
              </>
            )}
            {week.list.pazar} pazar, {week.list.market} market
          </span>
        </Link>
        <div className={s.sumCard} style={{ gap: 8 }}>
          <span className={s.sumLabel}>
            <IconSnowflake size={15} strokeWidth={2} />
            Bu hafta buzluktan çıkacaklar
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
            <span className={s.sumNote}>Bu hafta buzluktan çıkacak bir şey yok.</span>
          )}
        </div>
      </section>

      <div className={s.boardWrap}>
        {desktop ? (
          <Board days={week.days} matches={week.matches} frequent={week.frequent} handlers={handlers} />
        ) : (
          <DayList days={week.days} matches={week.matches} frequent={week.frequent} handlers={handlers} onPlace={(recipe, match) => setPlace({ recipe, match })} />
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
