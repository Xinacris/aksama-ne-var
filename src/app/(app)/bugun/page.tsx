"use client";

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
import { viewActivity } from "@/domain/activity";
import { menuFor, menuItems } from "@/domain/plan";
import { addDays } from "@/domain/dates";
import { now } from "@/lib/clock";
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

  const tomorrowPlanned = menuItems(menuFor(planItems, addDays(model.today, 1))).length > 0;
  const names = people.map((p) => p.name).join(" ve ");
  const approval = model.tonight ? model.tonight.approval : null;
  const canApprove = approval && (approval.kind === "waitingMe" || approval.kind === "none" || (approval.kind === "solo" && !approval.approved));

  async function onAteOut() {
    await ateOut(model.today);
    setNotice({ kind: "info", text: "Afiyet olsun. Menü eşleşmelere döndü, malzemeler listede kalıyor." });
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div className={s.titles}>
          <span className={s.date}>{model.dateLabel}</span>
          <h1 className={s.title}>Akşama ne var?</h1>
        </div>
        <div className={s.headRight}>
          <Link href="/ayarlar" className={s.avatarLink} aria-label={`Ev halkı: ${names} · Ayarlar`}>
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
            <Link href="/akis" className={s.partner} aria-label="Ev hareketlerinin hepsi">
              <ActivityLine person={personById.get(model.partnerLine.actorId)!} text={model.partnerLine.text} when={model.partnerLine.when} />
            </Link>
          )}

          {model.tonight ? (
            <div className={s.card}>
              <TonightCard
                photoDish={model.tonight.photoDish}
                title={model.tonight.title}
                rows={model.tonight.rows}
                approval={approvalPill(model.tonight.approval)}
                href={`/tarif/${model.tonight.mainId}?gun=${model.today}`}
                action={
                  canApprove ? (
                    <div>
                      <button type="button" className={menuCardStyles.approveBtn} onClick={() => approve(model.today)}>
                        <IconCheck size={16} strokeWidth={2.4} />
                        {approval?.kind === "waitingMe" ? "Ben de onaylıyorum" : "Menüyü onayla"}
                      </button>
                    </div>
                  ) : undefined
                }
              />
            </div>
          ) : model.ateOut ? (
            <section aria-label="Bu akşam" className={s.ateOut}>
              <span className={s.ateIcon}>
                <IconCutlery size={22} />
              </span>
              <h2 className={s.ateTitle}>Bu akşam dışarıdasınız</h2>
              <p className={s.muted} style={{ margin: 0, lineHeight: 1.45 }}>
                {model.returnedNames.length
                  ? `Planlanan ${model.returnedNames.join(", ").toLocaleLowerCase("tr")} eşleşmelere geri döndü.`
                  : "Afiyet olsun."}
              </p>
              <Button variant="link" size="sm" onClick={() => clearAteOut(model.today)}>
                Geri al
              </Button>
            </section>
          ) : (
            <div className={s.empty}>
              <EmptyState
                title={leaveEmpty ? "Bu akşam serbest" : "Bu akşam henüz boş"}
                text={
                  leaveEmpty
                    ? "Canın ne isterse. Fikrin değişirse eşleşmeler burada."
                    : "Eşleşmelerden bir şey seçebilir ya da öyle bırakabilirsiniz."
                }
                actions={
                  <>
                    <ButtonLink href={`/eslesme?gun=${model.today}`} size="sm">
                      Eşleşmelerden seç
                    </ButtonLink>
                    {!leaveEmpty && (
                      <Button variant="secondary" size="sm" onClick={() => setLeaveEmpty(true)}>
                        Boş kalsın
                      </Button>
                    )}
                  </>
                }
              />
            </div>
          )}
        </div>

        <div className={s.col}>
          {model.leftover && (
            <section aria-label="Artan yemek" className={s.leftover}>
              <span className={s.leftIcon}>
                <IconLeftover size={22} />
              </span>
              <div className={s.leftTexts}>
                <p className={s.leftTitle}>
                  Dünkü {model.leftover.recipe.name.toLocaleLowerCase("tr")} bugün öğlen için yeterli.
                </p>
                <span className={s.muted}>Buzdolabında · yaklaşık {model.leftover.portions} porsiyon</span>
              </div>
            </section>
          )}

          {model.tonight && (
            <section aria-label="Plan değişirse" className={s.change}>
              <div className={s.changeGrid}>
                <button type="button" className={s.changeBtn} onClick={onAteOut}>
                  <IconCutlery size={18} />
                  Bugün dışarıda yedik
                </button>
                <button
                  type="button"
                  className={s.changeBtn}
                  aria-expanded={changeOpen}
                  aria-controls="plan-degisti"
                  onClick={() => setChangeOpen((v) => !v)}
                >
                  <IconSwap size={18} />
                  Plan değişti
                </button>
              </div>
              {changeOpen && (
                <div id="plan-degisti" className={s.options} role="group" aria-label="Plan değişti seçenekleri">
                  <button
                    type="button"
                    className={s.option}
                    onClick={async () => {
                      setChangeOpen(false);
                      await moveToTomorrow(model.today);
                    }}
                  >
                    {tomorrowPlanned ? "Yarınla yer değiştir" : "Yarına taşı"}
                    <span>{tomorrowPlanned ? "Bu akşamki menü yarına, yarınki bu akşama geçer." : "Bu akşamki menü yarın akşama geçer."}</span>
                  </button>
                  <button
                    type="button"
                    className={s.option}
                    onClick={async () => {
                      setChangeOpen(false);
                      await sendBack(model.today);
                    }}
                  >
                    Eşleşmelere geri gönder
                    <span>Bu akşam boş kalır; ana yemek sonra seçilmek üzere bekler.</span>
                  </button>
                  <button type="button" className={s.option} onClick={() => setChangeOpen(false)}>
                    Vazgeç
                  </button>
                </div>
              )}
              <p className={s.changeNote}>Olur böyle günler. Menü yarına ya da eşleşmelere geri döner, malzemeler listede kalır.</p>
            </section>
          )}

          {model.tomorrow ? (
            <Link href="/hafta" aria-label={`Yarın: ${model.tomorrow.line}`} className={s.tomorrow}>
              <div className={s.tomTexts}>
                <span className={s.eyebrow}>Yarın</span>
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
                <span className={s.eyebrow}>Yarın</span>
                <span className={s.tomLine}>Henüz boş</span>
                <span className={s.muted}>Birlikte kaydırıp seçebilirsiniz</span>
              </div>
            </Link>
          )}

          <RecentFeed />
        </div>
      </div>
    </main>
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
          Evde son hareketler
        </h2>
        <Link href="/akis" className={s.feedLink}>
          Hepsi
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
