"use client";

import { intlTag, listJoin, t, tagLabel } from "@anv/core/i18n";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Loading } from "@/components/Guard";
import { MatchList, matchNote } from "@/components/MatchList";
import { MatchMoment } from "@/components/MatchMoment";
import { SwipeDeck, type DeckCard } from "@/components/SwipeDeck";
import { IconChevronRight } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink, Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { PillRow } from "@/components/ui/PillRow";
import { SLOTS, SLOT_LABEL, type Match, type Slot } from "@anv/core/data/models";
import { addDays, dayName, eveningDative, eveningLabel, formatDuration } from "@anv/core/domain/dates";
import { numberAccusative } from "@anv/core/lib/text";
import { buildDeck, cuisineDeck, nextCard, nextOpenEvening, progress, recentlyPlannedIds, sortMatches, swipesFor } from "@anv/core/domain/matching";
import { daysSinceCooked, lastCookedMap, rotationLabel, rotationShort } from "@anv/core/domain/rotation";
import { dishInSentence } from "@anv/core/domain/prep";
import { cuisineLabelKey, toggleCuisine } from "@anv/core/recipes/cuisines";
import { usePeople } from "@/hooks/usePeople";
import { useSwipeCuisines } from "@/hooks/useSwipeCuisines";
import { recipesMap, useApp } from "@/store/app";
import s from "./page.module.css";

function listPhrase(names: string[]): string {
  return listJoin(names.map((x) => x.toLocaleLowerCase(intlTag())));
}

function EslesmeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const st = useApp();
  const { today, recipes, favorites, cookLog, planItems, planDays, matches, swipes, me, pantry } = st;
  const { people, partner } = usePeople();
  const swipe = useApp((x) => x.swipe);
  const dropOnDay = useApp((x) => x.dropOnDay);
  const setNotice = useApp((x) => x.setNotice);

  const date = params.get("gun") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("gun")!) ? params.get("gun")! : nextOpenEvening(planItems, planDays, today, addDays);
  const slotParam = params.get("slot") as Slot | null;
  const slot: Slot = slotParam && (SLOTS as readonly string[]).includes(slotParam) ? slotParam : "ana";

  const [chooser, setChooser] = useState(false);
  const [moment, setMoment] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const seenMatches = useRef<Set<string> | null>(null);
  const [cuisines, pickCuisines] = useSwipeCuisines();

  const byId = recipesMap(recipes);
  const last = useMemo(() => lastCookedMap(cookLog), [cookLog]);
  const solo = people.length < 2;

  const pool = useMemo(
    () =>
      buildDeck({
        recipes,
        favorites,
        lastCooked: last,
        slot,
        date,
        plannedRecipeIds: recentlyPlannedIds(planItems, today, addDays),
        matches,
        size: Infinity,
      }),
    [recipes, favorites, last, slot, date, planItems, today, matches],
  );
  const { available, active, deck } = useMemo(() => cuisineDeck(pool, cuisines), [pool, cuisines]);
  const mine = swipesFor(swipes, date, slot, me?.id);
  const card = nextCard(deck, mine);
  const myDone = progress(deck, mine);
  const partnerDone = partner ? progress(deck, swipesFor(swipes, date, slot, partner.id)) : 0;

  // Live: when the partner completes a match for this deck in another tab, show the moment here too.
  useEffect(() => {
    const ids = new Set(matches.map((m) => m.id));
    if (seenMatches.current === null) {
      seenMatches.current = ids;
      return;
    }
    const fresh = matches.find(
      (m) => !seenMatches.current!.has(m.id) && m.date === date && m.slot === slot && m.status === "open" && m.createdBy !== me?.id,
    );
    seenMatches.current = ids;
    if (fresh && !moment) setMoment(fresh);
  }, [matches, date, slot, me?.id, moment]);

  function go(nextDate: string, nextSlot: Slot) {
    setChooser(false);
    router.replace(`/eslesme?gun=${nextDate}&slot=${nextSlot}`);
  }

  async function decide(decision: "like" | "pass") {
    if (!card) return;
    const m = await swipe(card.id, date, slot, decision);
    if (m) {
      seenMatches.current?.add(m.id);
      setMoment(m);
    }
  }

  async function put() {
    if (!moment) return;
    setBusy(true);
    await dropOnDay({ date: moment.date, recipeId: moment.recipeId, origin: "match", matchId: moment.id, slot: moment.slot });
    const r = byId.get(moment.recipeId);
    setNotice({ kind: "info", text: t("eslesme.placed", { dish: r?.name ?? t("eslesme.dish"), evening: eveningDative(moment.date, today).toLocaleLowerCase(intlTag()) }) });
    setMoment(null);
    setBusy(false);
    router.replace(`/eslesme?slot=${slot}`);
  }

  const evening = eveningLabel(date, today);

  if (moment) {
    const r = byId.get(moment.recipeId);
    if (r) {
      const missing = r.ingredients.filter((i) => !i.staple && !pantry.some((p) => p.name === i.name)).map((i) => i.label ?? i.name);
      const listNote = missing.length
        ? t("eslesme.toList", { items: listPhrase(missing.slice(0, 4)).replace(/^./, (c) => c.toLocaleUpperCase(intlTag())), more: missing.length > 4 ? t("eslesme.andOthers") : "" })
        : t("eslesme.allHome");
      const days = daysSinceCooked(r.id, last, today);
      return (
        <main className={s.momentWrap}>
          <MatchMoment
            people={solo ? people.slice(0, 1) : people}
            title={solo ? t("eslesme.soloTitle", { dish: r.name }) : t("eslesme.bothTitle", { dish: dishInSentence(r.name) })}
            subtitle={t(solo ? "eslesme.soloSub" : "eslesme.bothSub", { evening: eveningLabel(moment.date, today) })}
            dishName={r.name}
            meta={`${r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes)} · ${rotationShort(days)}`}
            listNote={listNote}
            putLabel={t("eslesme.put", { evening: eveningDative(moment.date, today) })}
            onPut={put}
            onContinue={() => setMoment(null)}
            busy={busy}
          />
        </main>
      );
    }
  }

  const dayOptions = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const openMatches = sortMatches(matches)
    .filter((m) => m.status !== "placed" || (m.placedDate ?? "") >= today)
    .map((m) => ({ match: m, recipe: byId.get(m.recipeId)!, note: matchNote(m, daysSinceCooked(m.recipeId, last, today)) }))
    .filter((v) => v.recipe)
    .slice(0, 8);

  return (
    <main className={s.page}>
      <div className={s.deckCol}>
        <header className={s.header}>
          <div className={s.headRow}>
            <div className={s.titles}>
              <button
                type="button"
                className={s.context}
                aria-expanded={chooser}
                aria-controls="gun-sec"
                onClick={() => setChooser((v) => !v)}
              >
                {t("eslesme.context", { evening, slot: SLOT_LABEL[slot].toLocaleLowerCase(intlTag()) })}
                <IconChevronRight size={14} className={chooser ? s.chevOpen : s.chev} />
              </button>
              <h1 className={s.title}>{t("eslesme.title")}</h1>
            </div>
            {card && (
              <span className={s.counter} aria-label={t("eslesme.counter", { total: deck.length, n: myDone + 1 })}>
                {myDone + 1} / {deck.length}
              </span>
            )}
          </div>
          {chooser && (
            <div id="gun-sec" className={s.chooser} role="group" aria-label={t("eslesme.chooser")}>
              <div className={s.chooserRow}>
                {dayOptions.map((d) => (
                  <button key={d} type="button" className={s.opt} aria-pressed={d === date} onClick={() => go(d, slot)}>
                    {d === today ? t("eslesme.today") : dayName(d)}
                  </button>
                ))}
              </div>
              <div className={s.chooserRow}>
                {SLOTS.map((sl) => (
                  <button key={sl} type="button" className={s.opt} aria-pressed={sl === slot} onClick={() => go(date, sl)}>
                    {SLOT_LABEL[sl]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {partner && (
            <div className={s.partner}>
              <Avatar person={partner} size={24} />
              {t("eslesme.partnerProgress", { name: partner.name, total: deck.length, n: partnerDone, nAcc: numberAccusative(partnerDone) })}
            </div>
          )}
          {solo && <div className={s.partner}>{t("eslesme.solo")}</div>}
        </header>

        {available.length > 1 && (
          <PillRow
            label={t("eslesme.cuisineFilter")}
            options={[
              { key: "all", label: t("eslesme.allCuisines"), selected: active.length === 0, onToggle: () => pickCuisines([]) },
              ...available.map((c) => ({ key: c, label: t(cuisineLabelKey(c, "short")), selected: active.includes(c), onToggle: () => pickCuisines(toggleCuisine(cuisines, c)) })),
            ]}
          />
        )}

        <p className="visually-hidden" aria-live="polite">
          {card ? t("eslesme.live", { n: myDone + 1, total: deck.length, name: card.name }) : t("eslesme.out")}
        </p>

        {card ? (
          <SwipeDeck key={card.id} card={toDeckCard(card.id)} remaining={deck.length - myDone} onDecide={decide} />
        ) : active.length > 0 ? (
          <div className={s.done}>
            <EmptyState
              title={t("eslesme.filteredOut")}
              text={t("eslesme.filteredOutText")}
              actions={
                <Button size="sm" onClick={() => pickCuisines([])}>
                  {t("eslesme.clearFilters")}
                </Button>
              }
            />
          </div>
        ) : (
          <div className={s.done}>
            <EmptyState
              title={deck.length ? t("eslesme.out") : t("eslesme.noneForSlot")}
              text={
                deck.length
                  ? partner && partnerDone < deck.length
                    ? t("eslesme.partnerStill", { name: partner.name })
                    : t("eslesme.noCommon")
                  : t("eslesme.noneFit")
              }
              actions={
                <>
                  <Button size="sm" onClick={() => setChooser(true)}>
                    {t("eslesme.otherDay")}
                  </Button>
                  <ButtonLink href="/hafta" size="sm" variant="secondary">
                    {t("eslesme.toWeek")}
                  </ButtonLink>
                </>
              }
            />
          </div>
        )}
      </div>

      <aside className={s.aside} aria-labelledby="eslesmeler-baslik">
        <div className={s.asideCard}>
          <div className={s.asideHead}>
            <h2 id="eslesmeler-baslik" className={s.asideTitle}>
              {t("eslesme.matches")}
            </h2>
            <Link href="/hafta" className={s.asideLink}>
              {t("eslesme.placeInWeek")}
            </Link>
          </div>
          <MatchList items={openMatches} />
        </div>
        <p className={s.asideNote}>{t("eslesme.deckNote")}</p>
      </aside>
    </main>
  );

  function toDeckCard(id: string): DeckCard {
    const r = byId.get(id)!;
    const tags = r.tags.slice(0, 3).map(tagLabel);
    if (r.leftoverPolicy !== "none") tags.push(t("eslesme.leftoverTag"));
    return {
      recipe: r,
      time: r.timeNote ?? formatDuration(r.prepMinutes + r.cookMinutes),
      last: rotationLabel(daysSinceCooked(r.id, last, today), solo),
      tags,
    };
  }
}

export default function EslesmePage() {
  return (
    <Suspense fallback={<Loading />}>
      <EslesmeInner />
    </Suspense>
  );
}
