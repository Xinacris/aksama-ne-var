"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { IconCheck, IconClose, IconPlus } from "@/components/icons";
import { Avatar, type AvatarPerson } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DishChip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/Misc";
import { UNITS, type Side, type Unit } from "@anv/core/data/models";
import { catalogEntry, INGREDIENT_CATALOG } from "@anv/core/data/seed/ingredients";
import { groupList, remainingNote, sideCount, type ListRow } from "@anv/core/domain/shopping";
import { DESKTOP, useMediaQuery } from "@/hooks/useMediaQuery";
import { usePeople } from "@/hooks/usePeople";
import { usePartnerPresence } from "@/hooks/usePresence";
import { now } from "@anv/core/lib/clock";
import { selectList, useApp } from "@/store/app";
import s from "./page.module.css";

/** A partner's check stays highlighted ("Zeynep aldı · az önce") for two minutes. */
const FRESH_MS = 2 * 60 * 1000;

export default function ListePage() {
  const st = useApp();
  const rows = useMemo(() => selectList(st), [st]);
  const me = st.me;
  const sync = st.sync;
  const toggleCheck = useApp((x) => x.toggleCheck);
  const removeManualItem = useApp((x) => x.removeManualItem);
  const finishShopping = useApp((x) => x.finishShopping);
  const setNotice = useApp((x) => x.setNotice);
  const { byId, partner } = usePeople();
  const atMarket = usePartnerPresence("/liste");
  const desktop = useMediaQuery(DESKTOP);
  const [tab, setTab] = useState<Side>("market");
  const [adding, setAdding] = useState(false);
  const [, setTick] = useState(0);

  // Re-render so "az önce" highlights fade on their own.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  async function finish() {
    if (!rows.some((r) => r.checkedBy)) {
      setNotice({ kind: "info", text: "Önce aldıklarını işaretle; alınmayanlar listede bekler." });
      return;
    }
    const n = await finishShopping();
    setNotice({ kind: "info", text: `${n} ürün “evde var”a geçti. Alınmayanlar listede bekliyor.` });
  }

  const sides: Side[] = desktop ? ["pazar", "market"] : [tab];

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div className={s.headRow}>
          <div className={s.titles}>
            <span className={s.eyebrow}>Bu haftanın listesi</span>
            <h1 className={s.title}>Alışveriş</h1>
          </div>
          <button type="button" className={s.addBtn} aria-label="Ürün ekle" onClick={() => setAdding(true)}>
            <IconPlus size={22} />
          </button>
        </div>

        {partner && (
          <div role="status" className={s.presence}>
            <span className={s.ava}>
              {atMarket && <span className={s.ping} aria-hidden="true" style={{ background: partner.color }} />}
              <Avatar person={partner} size={28} className={s.avaInner} />
            </span>
            <span className={s.presenceText}>
              {atMarket ? (
                <>
                  <strong>{partner.name} de markette.</strong> <span>İşaretledikleri anında burada.</span>
                </>
              ) : (
                <span>{partner.name} bir şey işaretleyince anında burada görürsün.</span>
              )}
            </span>
            <span className={[s.live, sync === "syncing" && s.liveSync, sync === "offline" && s.liveOff].filter(Boolean).join(" ")}>
              <span className={s.dot} />
              {sync === "offline" ? "Çevrimdışı" : sync === "syncing" ? "Eşitleniyor" : "Canlı"}
            </span>
          </div>
        )}

        {!desktop && rows.length > 0 && (
          <div role="tablist" aria-label="Liste bölümü" className={s.tabs}>
            {(["pazar", "market"] as Side[]).map((side) => (
              <button
                key={side}
                type="button"
                role="tab"
                id={`tab-${side}`}
                aria-selected={tab === side}
                aria-controls={`panel-${side}`}
                className={s.tab}
                onClick={() => setTab(side)}
              >
                {side === "pazar" ? "Pazar" : "Market"} <span className={s.count}>{sideCount(rows, side)}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {rows.length === 0 ? (
        <div className={s.empty}>
          <EmptyState
            title="Liste şimdilik boş"
            text="Plana yemek ekledikçe eksik malzemeler buraya kendiliğinden gelir."
            actions={
              <>
                <ButtonLink href="/hafta" size="sm">
                  Haftaya git
                </ButtonLink>
                <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                  Ürün ekle
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <div className={s.columns}>
          {sides.map((side) => (
            <div
              key={side}
              className={s.column}
              role={desktop ? undefined : "tabpanel"}
              id={`panel-${side}`}
              aria-labelledby={desktop ? `col-${side}` : `tab-${side}`}
            >
              {desktop && (
                <h2 id={`col-${side}`} className={s.colTitle}>
                  {side === "pazar" ? "Pazar" : "Market"} <span className={s.count}>{sideCount(rows, side)}</span>
                </h2>
              )}
              {groupList(rows, side).map((g) => (
                <section key={g.title} className={s.group} aria-label={g.title}>
                  <h3 className={s.groupTitle}>
                    {g.title}
                    <span className={s.groupNote}>{g.note}</span>
                  </h3>
                  <ul className={s.rows}>
                    {g.items.map((it) => (
                      <Row
                        key={it.key}
                        row={it}
                        meId={me?.id}
                        who={it.checkedBy ? byId.get(it.checkedBy) ?? null : null}
                        onToggle={() => toggleCheck(it)}
                        onRemove={it.manualItemId ? () => removeManualItem(it.manualItemId!) : undefined}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              {groupList(rows, side).length === 0 && (
                <p className={s.remaining} style={{ padding: "16px 0" }}>
                  {side === "pazar" ? "Pazardan alınacak bir şey yok." : "Marketten alınacak bir şey yok."}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={s.spacer} />
      {rows.length > 0 && (
        <div className={s.footer}>
          <button type="button" className={s.finish} onClick={finish}>
            Alışverişi bitir
          </button>
          <span className={s.remaining}>{remainingNote(rows)}</span>
        </div>
      )}

      <AddItemDialog open={adding} onClose={() => setAdding(false)} defaultSide={tab} />
    </main>
  );
}

function Row({
  row,
  meId,
  who,
  onToggle,
  onRemove,
}: {
  row: ListRow;
  meId: string | undefined;
  who: AvatarPerson | null;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const checked = !!row.checkedBy;
  const byPartner = checked && row.checkedBy !== meId;
  const fresh = byPartner && !!row.checkedAt && now().getTime() - new Date(row.checkedAt).getTime() < FRESH_MS;
  const label = `${row.name}${row.quantityText ? `, ${row.quantityText}` : ""}${checked && who ? `, ${who.name} aldı` : ""}`;
  return (
    <li className={s.li}>
      <button
        type="button"
        aria-pressed={checked}
        aria-label={label}
        className={[s.row, checked && !fresh && s.checked, fresh && s.fresh].filter(Boolean).join(" ")}
        onClick={onToggle}
      >
        <span className={s.box} style={checked && who ? { background: who.color } : undefined}>
          {checked && (byPartner ? who?.initial : <IconCheck size={18} strokeWidth={2.6} />)}
        </span>
        <span className={[s.texts, checked && !fresh && s.dim].filter(Boolean).join(" ")}>
          <span className={s.line1}>
            <span className={s.name}>{row.name}</span>
            <span className={s.qty}>{row.quantityText}</span>
          </span>
          <span className={s.line2}>
            <span className={s.for}>{row.forLabel || "Elle eklendi"}</span>
            {fresh && who && <span className={s.freshNote}>{who.name} aldı · az önce</span>}
          </span>
        </span>
      </button>
      {onRemove && (
        <button type="button" className={s.remove} onClick={onRemove} aria-label={`${row.name} listeden kaldır`}>
          <IconClose size={18} />
        </button>
      )}
    </li>
  );
}

function AddItemDialog({ open, onClose, defaultSide }: { open: boolean; onClose: () => void; defaultSide: Side }) {
  const addManualItem = useApp((x) => x.addManualItem);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [side, setSide] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entry = catalogEntry(name.trim().charAt(0).toLocaleUpperCase("tr") + name.trim().slice(1));
  const effectiveSide = side ?? entry?.side ?? defaultSide;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ürünün adını yazar mısın?");
      return;
    }
    const q = qty.trim() ? Number(qty.replace(",", ".")) : null;
    if (q !== null && (!Number.isFinite(q) || q <= 0)) {
      setError("Miktar bir sayı olsun (ör. 2 ya da 1,5).");
      return;
    }
    await addManualItem({ name, quantity: q, unit: q === null ? null : unit || "adet", side: effectiveSide, aisle: entry?.side === effectiveSide ? entry.aisle : effectiveSide === "pazar" ? "Sebze" : "Diğer" });
    setName("");
    setQty("");
    setUnit("");
    setSide(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} eyebrow="Listeye ekle" title="Ne lazım?">
      <form className={s.form} onSubmit={submit} noValidate>
        <TextField label="Ürün" list="urunler" value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. limon, deterjan" error={error} autoFocus />
        <datalist id="urunler">
          {INGREDIENT_CATALOG.filter((c) => !c.staple).map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
        <div className={s.formRow}>
          <TextField label="Miktar" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="isteğe bağlı" />
          <SelectField label="Birim" value={unit} onChange={(e) => setUnit(e.target.value as Unit | "")}>
            <option value="">—</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </SelectField>
        </div>
        <div role="group" aria-label="Nereden alınacak" className={s.sides}>
          <DishChip selected={effectiveSide === "pazar"} onClick={() => setSide("pazar")}>
            Pazar
          </DishChip>
          <DishChip selected={effectiveSide === "market"} onClick={() => setSide("market")}>
            Market
          </DishChip>
        </div>
        <Button type="submit" size="lg" block>
          Listeye ekle
        </Button>
      </form>
    </Dialog>
  );
}
