"use client";

import { intlTag, listJoin, t } from "@anv/core/i18n";
import Link from "next/link";
import { useMemo, useState } from "react";
import { menuCardStyles, TonightCard } from "@/components/MenuCard";
import { ReminderBanner } from "@/components/ReminderBanner";
import { IconCheck, IconCutlery, IconLeftover, IconSwap } from "@/components/icons";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { ButtonLink, Button } from "@/components/ui/Button";
import { ActivityLine, EmptyState, SyncInline } from "@/components/ui/Misc";
import { usePeople } from "@/hooks/usePeople";
import { usePartnerPresence } from "@/hooks/usePresence";
import { approvalPill, useToday } from "@/hooks/useToday";
import { viewActivity } from "@anv/core/domain/activity";
import { menuFor, menuItems } from "@anv/core/domain/plan";
import { dishInSentence } from "@anv/core/domain/prep";
import { addDays, dayName, eveningLabel } from "@anv/core/domain/dates";
import { keepUntilLabel, type EveningLeftover } from "@anv/core/domain/leftovers";
import { LeftoverChoices } from "@/components/LeftoverChoices";
import { DayPicker } from "@/components/week/Dialogs";
import { now } from "@anv/core/lib/clock";
import { recipesMap, useApp, usersMap } from "@/store/app";
import s from "./page.module.css";

export default function BugunPage() {
  const model = useToday();
  const { people, byId: personById } = usePeople();
  const sync = useApp((st) => st.sync);
  const planItems = useApp((st) => st.planItems);
  const completeTask = useApp((st) => st.completeTask);
  const undoTask = useApp((st) => st.undoTask);
  const approve = useApp((st) => st.approve);
  const ateOut = useApp((st) => st.ateOut);
  const clearAteOut = useApp((st) => st.clearAteOut);
  const sendBack = useApp((st) => st.sendBackToMatches);
  const moveToTomorrow = useApp((st) => st.moveToTomorrow);
  const setNotice = useApp((st) => st.setNotice);
  const present = usePartnerPresence();
  const [changeOpen, setChangeOpen] = useState(false);
  const [leaveEmpty, setLeaveEmpty] = useState(false);
  const [place, setPlace] = useState<EveningLeftover | null>(null);

  const tomorrowPlanned = menuItems(menuFor(planItems, addDays(model.today, 1))).length > 0;
  const names = listJoin(people.map((p) => p.name));
  const approval = model.tonight ? model.tonight.approval : null;
  const canApprove = approval && (approval.kind === "waitingMe" || approval.kind === "none" || (approval.kind === "solo" && !approval.approved));

  async function onAteOut() {
    await ateOut(model.today);
    setNotice({ kind: "info", text: t("bugun.ateOutNotice") });
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div className={s.titles}>
          <span className={s.date}>{model.dateLabel}</span>
          <h1 className={s.title}>{t("app.name")}</h1>
        </div>
        <div className={s.headRight}>
          <Link href="/ayarlar" className={s.avatarLink} aria-label={t("nav.household", { names })}>
            <AvatarStack people={people} size={34} ringIds={present ? [present.id] : []} />
          </Link>
          <SyncInline state={sync} />
        </div>
      </header>

      <div className={s.cols}>
        <div className={s.col}>
          {model.reminder && (
            <div className={s.banner}>
              <ReminderBanner
                text={model.reminder.text}
                meta={model.reminder.meta}
                done={model.reminder.task.status === "done"}
                doneBy={model.reminder.task.doneBy ? personById.get(model.reminder.task.doneBy) : null}
                doneAt={model.reminder.doneAt ?? undefined}
                actionLabel={model.reminder.actionLabel}
                onDone={() => completeTask(model.reminder!.task.id)}
                onUndo={() => undoTask(model.reminder!.task.id)}
              />
            </div>
          )}

          {model.partnerLine && personById.get(model.partnerLine.actorId) && (
            <Link href="/akis" className={s.partner} aria-label={t("bugun.feedAll")}>
              <ActivityLine person={personById.get(model.partnerLine.actorId)!} text={model.partnerLine.text} when={model.partnerLine.when} />
            </Link>
          )}

          {model.tonight ? (
            <div className={s.card}>
              <TonightCard
                photoDish={model.tonight.photoDish}
                title={model.tonight.title}
                rows={model.tonight.rows}
                approval={model.tonight.cooked ? { tone: "ok", label: t("bugun.cookedPill") } : approvalPill(model.tonight.approval)}
                href={`/tarif/${model.tonight.mainId}?gun=${model.today}`}
                cook={
                  model.tonight.cooked ? undefined : model.tonight.cooking ? (
                    <CookingRow cooking={model.tonight.cooking} href={`/pisir/${model.today}`} />
                  ) : (
                    <ButtonLink href={`/pisir/${model.today}`} size="lg" block>
                      {t("bugun.startCooking")}
                    </ButtonLink>
                  )
                }
                action={
                  model.tonight.leftover ? (
                    <LeftoverChoices ev={model.tonight.leftover} when="tonight" />
                  ) : canApprove ? (
                    <div>
                      <button type="button" className={menuCardStyles.approveBtn} onClick={() => approve(model.today)}>
                        <IconCheck size={16} strokeWidth={2.4} />
                        {approval?.kind === "waitingMe" ? t("bugun.meToo") : t("dlg.approve")}
                      </button>
                    </div>
                  ) : undefined
                }
              />
            </div>
          ) : model.ateOut ? (
            <section aria-label={t("bugun.tonight")} className={s.ateOut}>
              <span className={s.ateIcon}>
                <IconCutlery size={22} />
              </span>
              <h2 className={s.ateTitle}>{t("bugun.outTonight")}</h2>
              <p className={s.muted} style={{ margin: 0, lineHeight: 1.45 }}>
                {model.returnedNames.length
                  ? t("week.returned", { dishes: model.returnedNames.join(", ").toLocaleLowerCase(intlTag()) })
                  : t("bugun.enjoy")}
              </p>
              <Button variant="link" size="sm" onClick={() => clearAteOut(model.today)}>
                {t("common.undo")}
              </Button>
            </section>
          ) : (
            <div className={s.empty}>
              <EmptyState
                title={t(leaveEmpty ? "bugun.free" : "bugun.empty")}
                text={
                  leaveEmpty
                    ? t("bugun.freeText")
                    : t("bugun.emptyText")
                }
                actions={
                  <>
                    <ButtonLink href={`/eslesme?gun=${model.today}`} size="sm">
                      {t("bugun.pickMatch")}
                    </ButtonLink>
                    {!leaveEmpty && (
                      <Button variant="secondary" size="sm" onClick={() => setLeaveEmpty(true)}>
                        {t("bugun.leaveEmpty")}
                      </Button>
                    )}
                  </>
                }
              />
            </div>
          )}
        </div>

        <div className={s.col}>
          {model.leftover && <YesterdayCard ev={model.leftover} today={model.today} onPlace={setPlace} />}

          {model.fridge.length > 0 && (
            <section aria-labelledby="dolapta" className={s.fridge}>
              <h2 id="dolapta" className={s.fridgeTitle}>
                {t("week.inFridge")}
              </h2>
              <ul className={s.fridgeList}>
                {model.fridge.map((f) => (
                  <FridgeRow key={f.fromDate} ev={f} today={model.today} onPlace={setPlace} />
                ))}
              </ul>
            </section>
          )}

          {model.tonight && (
            <section aria-label={t("bugun.ifChanges")} className={s.change}>
              <div className={s.changeGrid}>
                <button type="button" className={s.changeBtn} onClick={onAteOut}>
                  <IconCutlery size={18} />
                  {t("bugun.ateOutToday")}
                </button>
                <button
                  type="button"
                  className={s.changeBtn}
                  aria-expanded={changeOpen}
                  aria-controls="plan-degisti"
                  onClick={() => setChangeOpen((v) => !v)}
                >
                  <IconSwap size={18} />
                  {t("bugun.planChanged")}
                </button>
              </div>
              {changeOpen && (
                <div id="plan-degisti" className={s.options} role="group" aria-label={t("bugun.planChangedOptions")}>
                  <button
                    type="button"
                    className={s.option}
                    onClick={async () => {
                      setChangeOpen(false);
                      await moveToTomorrow(model.today);
                    }}
                  >
                    {t(tomorrowPlanned ? "bugun.swapTomorrow" : "bugun.moveTomorrow")}
                    <span>{t(tomorrowPlanned ? "bugun.swapTomorrowSub" : "bugun.moveTomorrowSub")}</span>
                  </button>
                  <button
                    type="button"
                    className={s.option}
                    onClick={async () => {
                      setChangeOpen(false);
                      await sendBack(model.today);
                    }}
                  >
                    {t("bugun.sendBack")}
                    <span>{t("bugun.sendBackSub")}</span>
                  </button>
                  <button type="button" className={s.option} onClick={() => setChangeOpen(false)}>
                    {t("form.bulk.cancel")}
                  </button>
                </div>
              )}
              <p className={s.changeNote}>{t("bugun.changeNote")}</p>
            </section>
          )}

          {model.tomorrow ? (
            <Link href="/hafta" aria-label={t("bugun.tomorrowAria", { line: model.tomorrow.line })} className={s.tomorrow}>
              <div className={s.tomTexts}>
                <span className={s.eyebrow}>{t("bugun.tomorrow")}</span>
                <span className={s.tomLine}>{model.tomorrow.line}</span>
                {model.tomorrow.sub && <span className={s.muted}>{model.tomorrow.sub}</span>}
              </div>
              {model.tomorrow.avatarId && personById.get(model.tomorrow.avatarId) && (
                <Avatar person={personById.get(model.tomorrow.avatarId)!} size={28} />
              )}
            </Link>
          ) : (
            <Link href={`/eslesme?gun=${addDays(model.today, 1)}`} className={s.tomorrow}>
              <div className={s.tomTexts}>
                <span className={s.eyebrow}>{t("bugun.tomorrow")}</span>
                <span className={s.tomLine}>{t("bugun.tomorrowEmpty")}</span>
                <span className={s.muted}>{t("bugun.tomorrowEmptySub")}</span>
              </div>
            </Link>
          )}

          <RecentFeed />
        </div>
      </div>
      <DayPicker
        target={place && place.outcome.kind === "fridge" ? { recipe: place.recipe, leftover: { fromDate: place.fromDate, useBy: place.outcome.useBy } } : null}
        onClose={() => setPlace(null)}
      />
    </main>
  );
}

/** "Ali pişiriyor · adım 3/20" with a small progress bar; the cook sees "Pişiyor" and "Devam et". */
function CookingRow({ cooking, href }: { cooking: { userId: string; step: number; total: number }; href: string }) {
  const me = useApp((st) => st.me);
  const { byId } = usePeople();
  const who = byId.get(cooking.userId);
  const mine = cooking.userId === me?.id;
  const label = cooking.step === 0 ? t("bugun.prepPhase") : t("cook.progress", { step: cooking.step, total: cooking.total });
  return (
    <div className={s.cooking}>
      <div className={s.cookingTop}>
        <span className={s.cookingText} role="status">
          <span className={s.cookingDot} aria-hidden="true" />
          {mine || !who ? t("bugun.cooking") : t("bugun.whoCooking", { name: who.name })} · {label}
        </span>
        <Link href={href} className={s.cookingLink}>
          {mine ? t("bugun.continue") : t("bugun.peek")}
        </Link>
      </div>
      <span className={s.cookingTrack} aria-hidden="true">
        <span className={s.cookingFill} style={{ width: `${cooking.total ? Math.round((cooking.step / cooking.total) * 100) : 0}%` }} />
      </span>
    </div>
  );
}

/** "Dünkü kuru fasulye bugün öğlen için yeterli." + the one-tap leftover choices. */
function YesterdayCard({ ev, today, onPlace }: { ev: EveningLeftover; today: string; onPlace: (ev: EveningLeftover) => void }) {
  const name = dishInSentence(ev.recipe.name);
  const k = ev.outcome.kind;
  const title =
    t(k === "lunch" ? "bugun.yLunch" : k === "fridge" ? "bugun.yFridge" : k === "discard" ? "bugun.yDiscard" : "bugun.yNone", { dish: name });
  const sub =
    k === "lunch"
      ? t("bugun.inFridgePortions", { count: ev.portions })
      : k === "fridge"
        ? t("bugun.untilPortions", { until: keepUntilLabel(ev.outcome.useBy, today), count: ev.portions })
        : null;
  return (
    <section aria-label={t("cook.leftoverRegion")} className={s.leftover}>
      <span className={s.leftIcon}>
        <IconLeftover size={22} />
      </span>
      <div className={s.leftTexts}>
        <p className={s.leftTitle}>{title}</p>
        {sub && <span className={s.muted}>{sub}</span>}
        <LeftoverChoices ev={ev} when="yesterday" title={t("bugun.fromYesterday")} />
        {k === "fridge" && (
          <button type="button" className={s.linkBtn} onClick={() => onPlace(ev)}>
            {t("bugun.putOnEvening")}
          </button>
        )}
      </div>
    </section>
  );
}

/** A dolapta dish: until when it is good, put it on an evening, or mark it finished. */
function FridgeRow({ ev, today, onPlace }: { ev: EveningLeftover; today: string; onPlace: (ev: EveningLeftover) => void }) {
  const setLeftoverChoice = useApp((st) => st.setLeftoverChoice);
  if (ev.outcome.kind !== "fridge") return null;
  return (
    <li className={s.fridgeRow}>
      <span className={s.fridgeTexts}>
        <strong>{ev.recipe.name}</strong>
        <span className={s.muted}>
          {ev.plannedDate ? t("bugun.eatenOn", { evening: eveningLabel(ev.plannedDate, today) }) : t("bugun.cookedOn", { until: keepUntilLabel(ev.outcome.useBy, today), day: dayName(ev.fromDate) })}
        </span>
      </span>
      <span className={s.fridgeActions}>
        {!ev.plannedDate && (
          <button type="button" className={s.linkBtn} onClick={() => onPlace(ev)} aria-label={t("bugun.putNamed", { name: ev.recipe.name })}>
            {t("bugun.putShort")}
          </button>
        )}
        <button type="button" className={s.linkBtn} onClick={() => setLeftoverChoice(ev.fromDate, "eaten")} aria-label={t("bugun.doneNamed", { name: ev.recipe.name })}>
          {t("cook.done")}
        </button>
      </span>
    </li>
  );
}

/** Desktop-only: the latest few household moments, with a link to the full feed. */
function RecentFeed() {
  const activity = useApp((st) => st.activity);
  const recipes = useApp((st) => st.recipes);
  const people = useApp((st) => st.people);
  const today = useApp((st) => st.today);
  const { byId } = usePeople();
  const items = useMemo(() => {
    const users = usersMap(people);
    return activity
      .filter((a) => a.type !== "shopping.checked")
      .slice(0, 4)
      .map((a) => viewActivity(a, { recipesById: recipesMap(recipes), users, todayIso: today, now: now() }));
  }, [activity, recipes, people, today]);
  if (!items.length) return null;
  return (
    <section className={s.feed} aria-labelledby="son-hareketler">
      <div className={s.feedHead}>
        <h2 id="son-hareketler" className={s.feedTitle}>
          {t("bugun.recent")}
        </h2>
        <Link href="/akis" className={s.feedLink}>
          {t("bugun.all")}
        </Link>
      </div>
      <ul className={s.feedList}>
        {items.map((v) =>
          byId.get(v.actorId) ? (
            <li key={v.id}>
              <ActivityLine person={byId.get(v.actorId)!} text={v.text} when={v.when} />
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}
