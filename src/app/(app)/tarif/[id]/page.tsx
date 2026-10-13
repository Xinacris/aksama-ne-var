"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Loading } from "@/components/Guard";
import { sourceCredit } from "@/components/ImportSourceCard";
import { IconCheck, IconChevronLeft, IconImport, IconMinus, IconMore, IconPlus } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState, PhotoPlaceholder } from "@/components/ui/Misc";
import { DayPicker, RecipePicker } from "@/components/week/Dialogs";
import dialogStyles from "@/components/week/Dialogs.module.css";
import { useWeek } from "@/components/week/useWeek";
import { COURSE_LABEL, SLOTS, SLOT_SHORT, type Ingredient, type Recipe, type Slot } from "@/data/models";
import { clockTime, dayMonth, dayName, formatDuration, toIsoDate } from "@/domain/dates";
import { courseToSlot } from "@/domain/matching";
import { dayFor, menuFor, menuItems, menuTitle, totalMinutes } from "@/domain/plan";
import { dishInSentence, offsetLabel } from "@/domain/prep";
import { daysSinceCooked, lastCookedMap, rotationLabel } from "@/domain/rotation";
import { formatIngredientQuantity, ingredientStatus, recipeLabel } from "@/domain/shopping";
import { usePeople } from "@/hooks/usePeople";
import { dative, lowerFirstTr } from "@/lib/text";
import { recipesMap, selectList, useApp } from "@/store/app";
import s from "./page.module.css";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function TarifInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const st = useApp();
  const { today, recipes, planItems, planDays, prepTasks, household, cookLog, pantry, favorites } = st;
  const { byId: personById, people } = usePeople();
  const rows = useMemo(() => selectList(st), [st]);
  const byId = recipesMap(recipes);
  const recipe = byId.get(id);
  const gunParam = params.get("gun");
  const gun = gunParam === "today" ? today : gunParam && ISO.test(gunParam) ? gunParam : null;
  const completeTask = useApp((x) => x.completeTask);
  const undoTask = useApp((x) => x.undoTask);
  const addManualItem = useApp((x) => x.addManualItem);
  const markHave = useApp((x) => x.markHave);
  const unmarkHave = useApp((x) => x.unmarkHave);
  const toggleFavorite = useApp((x) => x.toggleFavorite);
  const deleteRecipe = useApp((x) => x.deleteRecipe);
  const [servings, setServings] = useState<number | null>(null);
  const [cooking, setCooking] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replace, setReplace] = useState<{ date: string; slot: Slot } | null>(null);
  const [place, setPlace] = useState<{ recipe: Recipe } | null>(null);
  const stepsRef = useRef<HTMLElement>(null);
  const week = useWeek(0);

  if (!recipe) {
    return (
      <main className={s.page}>
        <div className={s.bar}>
          <Link href="/tarifler" className={s.back}>
            <IconChevronLeft size={20} />
            Tarifler
          </Link>
        </div>
        <div style={{ padding: "16px" }}>
          <EmptyState
            title="Bu tarifi bulamadık"
            text="Silinmiş ya da link eksik olabilir. Tarifler arasında arayabilirsin."
            actions={
              <ButtonLink href="/tarifler" size="sm">
                Tariflere git
              </ButtonLink>
            }
          />
        </div>
      </main>
    );
  }

  const menu = gun ? menuFor(planItems, gun) : {};
  const items = menuItems(menu);
  const inMenu = items.some((i) => i.recipeId === recipe.id);
  const ctx = gun && inMenu ? gun : null;
  const mySlot = ctx ? SLOTS.find((sl) => menu[sl]?.recipeId === recipe.id) ?? null : null;
  const day = ctx ? dayFor(planDays, ctx) : undefined;
  const factorBase = recipe.servings;
  const shownServings = servings ?? recipe.servings;
  const factor = shownServings / factorBase;
  const last = lastCookedMap(cookLog);
  const solo = people.length < 2;
  const isFav = favorites.some((f) => f.recipeId === recipe.id);
  const custom = recipe.householdId !== null;

  const backHref = ctx ? (ctx === today ? "/bugun" : "/hafta") : "/tarifler";
  const backLabel = ctx ? (ctx === today ? "Bugün" : "Hafta") : "Tarifler";
  const eyebrow = ctx ? (ctx === today ? "Bu akşamın menüsü" : `${dayName(ctx)} akşamının menüsü`) : COURSE_LABEL[recipe.course];
  const title = ctx ? menuTitle(menu, byId) : recipe.name;
  const recipeMinutes = recipe.prepMinutes + recipe.cookMinutes;
  const metaParts = ctx
    ? [
        `${items.length} parça`,
        `yaklaşık ${formatDuration(totalMinutes(menu, byId))}`,
        `${recipe.servings} kişilik${day?.leftovers ? ", yarına da artar" : ""}`,
      ]
    : [recipe.timeNote ?? formatDuration(recipeMinutes), `${recipe.servings} kişilik`, recipe.leftoverFriendly ? "ertesi güne artar" : null];
  const rotation = rotationLabel(daysSinceCooked(recipe.id, last, today), solo);

  // Prep timeline: the day's tasks for the whole menu (design shows kıyma, köfte harcı and pilav together).
  const tasks = ctx ? prepTasks.filter((t) => t.date === ctx && items.some((i) => i.recipeId === t.recipeId)).sort((a, b) => a.dueAt.localeCompare(b.dueAt)) : [];
  const nextPending = tasks.find((t) => t.status === "pending");

  // Ingredients: staples collapse into one "Evde var" row like the design ("Kimyon, karabiber, tuz").
  const main = recipe.ingredients.filter((i) => !i.staple || (i.quantity !== null && i.name !== "Tuz"));
  const staples = recipe.ingredients.filter((i) => i.staple && !(i.quantity !== null && i.name !== "Tuz"));
  const freezerTask = ctx ? tasks.find((t) => t.recipeId === recipe.id && t.freezer) : undefined;

  function status(ing: Ingredient): { tone: "olive" | "sand" | "tomato"; label: string; action?: () => void; aria?: string } {
    if (ing.staple) return { tone: "olive", label: "Evde var" };
    if (ing.name === recipe!.freezerItem && pantry.some((p) => p.name === ing.name)) {
      return { tone: "olive", label: freezerTask?.status === "done" ? "Evde · çözülüyor" : "Evde · buzlukta" };
    }
    const st2 = ingredientStatus(ing, rows, pantry);
    const name = lowerFirstTr(ing.name);
    if (st2 === "evde") {
      const removable = pantry.some((p) => p.name === ing.name && p.quantity === null);
      return removable
        ? { tone: "olive", label: "Evde var", action: () => unmarkHave(ing.name), aria: `${name}: evde var işaretini kaldır` }
        : { tone: "olive", label: "Evde var" };
    }
    if (st2 === "listede") return { tone: "sand", label: "Listede", action: () => markHave(ing.name), aria: `${name}: evde var olarak işaretle` };
    return {
      tone: "tomato",
      label: "Eksik · ekle",
      action: () =>
        addManualItem({ name: ing.name, quantity: ing.quantity ? ing.quantity * factor : null, unit: ing.unit, side: ing.side, aisle: ing.aisle, forRecipeId: recipe!.id }),
      aria: `${name} listeye ekle`,
    };
  }

  const creator = recipe.createdBy ? personById.get(recipe.createdBy) : undefined;

  return (
    <main className={s.page}>
      <div className={s.bar}>
        <Link href={backHref} className={s.back}>
          <IconChevronLeft size={20} />
          {backLabel}
        </Link>
        <button type="button" className={s.more} aria-label="Diğer seçenekler" onClick={() => setMenuOpen(true)}>
          <IconMore size={20} />
        </button>
      </div>

      <header className={s.header}>
        <span className={s.eyebrow}>{eyebrow}</span>
        <h1 className={s.title}>{title}</h1>
        <span className={s.meta}>{metaParts.filter(Boolean).join(" · ")}</span>
        <span className={s.meta}>{rotation}</span>
      </header>

      {ctx && items.length > 1 && (
        <nav aria-label="Menünün parçaları" className={s.parts}>
          {SLOTS.filter((sl) => menu[sl]).map((sl) => {
            const r = byId.get(menu[sl]!.recipeId);
            if (!r) return null;
            const short = sl === "ana" ? "ANA" : SLOT_SHORT[sl].toLocaleUpperCase("tr");
            return (
              <Link key={sl} href={`/tarif/${r.id}?gun=${ctx}`} className={s.part} aria-current={r.id === recipe.id ? "true" : undefined}>
                <span className={s.partSlot}>{short}</span>
                {recipeLabel(r).replace(/ çorbası$/, "")}
              </Link>
            );
          })}
        </nav>
      )}

      <PhotoPlaceholder dish={recipe.name} height={190} radius={24} className={s.photo} />

      {(recipe.sourceUrl || recipe.source) && (
        <div className={s.source}>
          <span className={s.sourceIcon}>
            <IconImport size={18} />
          </span>
          <span className={s.sourceText}>
            <strong>{recipe.sourceUrl ? sourceCredit({ platform: recipe.sourcePlatform, author: recipe.sourceAuthor, url: recipe.sourceUrl }) : recipe.source}</strong>
            {creator && (
              <span>
                {" "}
                · {creator.name} ekledi, {dayMonth(toIsoDate(new Date(recipe.createdAt)))}
              </span>
            )}
          </span>
          {recipe.sourceUrl && (
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className={s.sourceLink}>
              {recipe.sourcePlatform === "web" || !recipe.sourcePlatform ? "Sayfayı aç" : "Videoyu aç"}
            </a>
          )}
        </div>
      )}

      {recipe.stub && (
        <div className={s.stub}>
          <EmptyState
            headingLevel={3}
            title="Bu tarifin ayrıntıları henüz yok"
            text="Malzemeleri ve adımları eklersen liste ve hatırlatmalar da bu yemek için çalışır."
            actions={
              <ButtonLink href={`/tarifler/${recipe.id}/duzenle`} size="sm">
                Tarifi tamamla
              </ButtonLink>
            }
          />
        </div>
      )}

      {(tasks.length > 0 || (!ctx && recipe.prepItems.length > 0)) && (
        <section aria-labelledby="onhazirlik" className={s.prep}>
          <div className={s.secHead}>
            <h2 id="onhazirlik" className={s.secTitle}>
              Ön hazırlık
            </h2>
            <span className={s.secNote}>Sofra {household?.dinnerTime ?? "19:30"}</span>
          </div>
          <ol className={s.timeline}>
            {ctx
              ? tasks.map((t) => {
                  const done = t.status === "done";
                  const doer = t.doneBy ? personById.get(t.doneBy) : undefined;
                  const assignee = t.assigneeId ? personById.get(t.assigneeId) : undefined;
                  const other = t.recipeId !== recipe.id ? byId.get(t.recipeId) : undefined;
                  const due = clockTime(new Date(t.dueAt));
                  const sub = done
                    ? `${doer?.name ?? "Biri"} yaptı · ${t.doneAt ? clockTime(new Date(t.doneAt)) : ""}`
                    : other
                      ? `${due} · ${dishInSentence(recipeLabel(other))} için`
                      : `${due}${assignee && !solo ? ` · ${dative(assignee.name)} hatırlatılacak` : ""}`;
                  return (
                    <li key={t.id} className={[s.tl, done && s.tlDone, t === nextPending && s.tlNext].filter(Boolean).join(" ")}>
                      <span className={s.tlWhen}>{offsetLabel(t.offset)}</span>
                      <button
                        type="button"
                        className={s.tlDot}
                        style={done ? { background: doer?.color ?? "var(--olive)" } : undefined}
                        aria-pressed={done}
                        aria-label={`${t.label}: ${done ? "yapıldı, geri al" : "yapıldı olarak işaretle"}`}
                        onClick={() => (done ? undoTask(t.id) : completeTask(t.id))}
                      >
                        {done && <IconCheck size={13} strokeWidth={3} />}
                      </button>
                      <span className={s.tlBody}>
                        <span className={s.tlLabel}>{t.label}</span>
                        <span className={s.tlSub}>{sub}</span>
                      </span>
                    </li>
                  );
                })
              : recipe.prepItems.map((p) => (
                  <li key={p.label} className={s.tl}>
                    <span className={s.tlWhen}>{offsetLabel(p.offset)}</span>
                    <span className={s.tlDot} aria-hidden="true" />
                    <span className={s.tlBody}>
                      <span className={s.tlLabel}>{p.label}</span>
                      <span className={s.tlSub}>Plana eklenince hatırlatılır</span>
                    </span>
                  </li>
                ))}
          </ol>
        </section>
      )}

      {recipe.ingredients.length > 0 && (
        <section aria-labelledby="malzemeler" className={s.ingredients}>
          <div className={s.secHead}>
            <h2 id="malzemeler" className={s.secTitle}>
              Malzemeler
            </h2>
            <div className={s.scaler}>
              <span className={s.secNote}>
                {recipeLabel(recipe)} · {shownServings} kişi
              </span>
              <button type="button" className={s.scaleBtn} aria-label="Bir kişi azalt" disabled={shownServings <= 1} onClick={() => setServings(Math.max(1, shownServings - 1))}>
                <IconMinus size={16} />
              </button>
              <button type="button" className={s.scaleBtn} aria-label="Bir kişi artır" disabled={shownServings >= 12} onClick={() => setServings(Math.min(12, shownServings + 1))}>
                <IconPlus size={16} />
              </button>
            </div>
          </div>
          <ul className={s.ingList}>
            {main.map((ing) => {
              const q = formatIngredientQuantity(ing, factor);
              const stt = status(ing);
              return (
                <li key={ing.name} className={s.ing}>
                  <span className={s.ingText}>
                    {q && <strong>{q}</strong>} {ing.quantity === null ? ing.name : lowerFirstTr(ing.name)}
                    {ing.note ? ` (${ing.note})` : ""}
                  </span>
                  <StatusPill tone={stt.tone} onClick={stt.action} label={stt.aria}>
                    {stt.label}
                  </StatusPill>
                </li>
              );
            })}
            {staples.length > 0 && (
              <li className={s.ing}>
                <span className={s.ingText}>
                  {staples
                    .map((i, idx) => (idx === 0 ? i.name : lowerFirstTr(i.name)))
                    .join(", ")}
                </span>
                <StatusPill tone="olive">Evde var</StatusPill>
              </li>
            )}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section aria-labelledby="adimlar" className={[s.steps, cooking && s.cooking].filter(Boolean).join(" ")} ref={stepsRef}>
          <h2 id="adimlar" className={s.secTitle}>
            Hazırlanışı
          </h2>
          <ol className={s.stepList}>
            {recipe.steps.map((text, i) => {
              const done = doneSteps.has(i);
              return (
                <li key={i} className={[s.step, done && s.stepDone].filter(Boolean).join(" ")}>
                  {cooking ? (
                    <button
                      type="button"
                      className={s.stepNum}
                      aria-pressed={done}
                      aria-label={`${i + 1}. adım ${done ? "tamam, geri al" : "tamam olarak işaretle"}`}
                      onClick={() => {
                        const next = new Set(doneSteps);
                        if (done) next.delete(i);
                        else next.add(i);
                        setDoneSteps(next);
                      }}
                    >
                      {done ? <IconCheck size={14} strokeWidth={3} /> : i + 1}
                    </button>
                  ) : (
                    <span className={s.stepNum} aria-hidden="true">
                      {i + 1}
                    </span>
                  )}
                  <p className={s.stepText}>{text}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className={s.actions}>
        {recipe.steps.length > 0 && (
          <Button
            size="lg"
            onClick={() => {
              setCooking((c) => !c);
              if (!cooking) stepsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            aria-pressed={cooking}
          >
            {cooking ? "Pişirme modunu kapat" : "Pişirmeye başla"}
          </Button>
        )}
        {ctx && mySlot ? (
          <Button variant="secondary" size="md" onClick={() => setReplace({ date: ctx, slot: mySlot })}>
            Bu parçayı başka yemekle değiştir
          </Button>
        ) : courseToSlot(recipe.course) ? (
          <Button variant="secondary" size="md" onClick={() => setPlace({ recipe })}>
            Bir akşama koy
          </Button>
        ) : null}
      </div>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} eyebrow="Tarif" title={recipe.name}>
        <ul className={s.dialogList}>
          <li>
            <button
              type="button"
              className={dialogStyles.option}
              aria-pressed={isFav}
              onClick={async () => {
                await toggleFavorite(recipe.id);
                setMenuOpen(false);
              }}
            >
              {isFav ? "Sık yaptıklarımızdan çıkar" : "Sık yaptıklarımıza ekle"}
            </button>
          </li>
          <li>
            <Link className={dialogStyles.option} href={custom ? `/tarifler/${recipe.id}/duzenle` : `/tarifler/yeni?kopya=${recipe.id}`}>
              <span className={dialogStyles.optionText}>
                {custom ? "Tarifi düzenle" : "Kopyasını düzenle"}
                {!custom && <span className={dialogStyles.optionSub}>Hazır tarif değişmez; size özel bir kopyası açılır.</span>}
              </span>
            </Link>
          </li>
          {custom && (
            <li>
              {confirmDelete ? (
                <button
                  type="button"
                  className={`${dialogStyles.option} ${dialogStyles.danger}`}
                  onClick={async () => {
                    await deleteRecipe(recipe.id);
                    setMenuOpen(false);
                    router.push("/tarifler");
                  }}
                >
                  <span className={dialogStyles.optionText}>
                    Evet, sil
                    <span className={dialogStyles.optionSub}>Plandaysa o gün “silinmiş tarif” olarak görünür.</span>
                  </span>
                </button>
              ) : (
                <button type="button" className={`${dialogStyles.option} ${dialogStyles.danger}`} onClick={() => setConfirmDelete(true)}>
                  Tarifi sil
                </button>
              )}
            </li>
          )}
        </ul>
      </Dialog>
      <RecipePicker target={replace} onClose={() => setReplace(null)} matches={week.matches} frequent={week.frequent} />
      <DayPicker target={place} onClose={() => setPlace(null)} />
    </main>
  );
}

export default function TarifPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TarifInner />
    </Suspense>
  );
}
