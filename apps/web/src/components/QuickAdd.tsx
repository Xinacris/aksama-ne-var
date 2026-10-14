"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { importHref, quickAddIntent, type QuickAdd } from "@anv/core/domain/quickAdd";
import { useApp } from "@/store/app";
import { IconArrowRight, IconLink, IconPlus } from "./icons";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { TextField } from "./ui/Field";
import s from "./QuickAdd.module.css";

const sameName = (a: string, b: string) => a.toLocaleLowerCase("tr") === b.toLocaleLowerCase("tr");

/**
 * One-tap adding: a link goes to the import flow, a dish name is saved as a
 * recipe with only its name ("ayrıntı bekliyor") and its page opens.
 */
export function useQuickAdd() {
  const router = useRouter();
  const recipes = useApp((x) => x.recipes);
  const addStubRecipe = useApp((x) => x.addStubRecipe);
  const [busy, setBusy] = useState(false);

  const existing = (q: QuickAdd) => (q.kind === "name" ? recipes.find((r) => sameName(r.name, q.name)) : undefined);

  async function go(q: QuickAdd): Promise<void> {
    if (q.kind === "empty") return;
    if (q.kind === "url" || q.kind === "text") {
      router.push(importHref(q));
      return;
    }
    const known = existing(q);
    if (known) {
      router.push(`/tarif/${known.id}`);
      return;
    }
    setBusy(true);
    try {
      const r = await addStubRecipe(q.name);
      if (r) router.push(`/tarif/${r.id}?yeni=1`);
    } finally {
      setBusy(false);
    }
  }
  return { go, busy, existing };
}

function actionLabel(q: QuickAdd, known: boolean): string {
  if (q.kind === "url") return "Linkten içe aktar";
  if (q.kind === "text") return "Metni içe aktar";
  if (known) return "Tarifi aç";
  return "Kaydet";
}

function hintFor(q: QuickAdd, knownName: string | null): string {
  if (q.kind === "url") return "Link tanındı: tarifi içe aktaracağız, kaydetmeden önce kontrol edersin.";
  if (q.kind === "text") return "Uzun bir metin: tarif metni olarak içe aktaracağız.";
  if (knownName) return `“${knownName}” zaten defterde, onu açacağız.`;
  if (q.kind === "name") return "Adıyla kaydedilir; malzemeleri ve adımları sonra eklersin.";
  return "Instagram, YouTube, TikTok ya da bir tarif sitesi linki de olur.";
}

export function QuickAddSheet({ open, onClose, initial = "" }: { open: boolean; onClose: () => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const { go, busy, existing } = useQuickAdd();
  const q = quickAddIntent(value);
  const known = existing(q);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (q.kind === "empty") {
      setError("Bir link yapıştır ya da yemeğin adını yaz.");
      return;
    }
    setError(null);
    void go(q);
  }

  const detailed = `/tarifler/yeni${q.kind === "name" ? `?ad=${encodeURIComponent(q.name)}` : ""}`;

  return (
    <Dialog open={open} onClose={onClose} title="Yeni tarif">
      <form onSubmit={submit} className={s.form} noValidate>
        <TextField
          label="Link yapıştır ya da yemeğin adını yaz"
          placeholder="ör. Annemin dolması"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          hint={hintFor(q, known?.name ?? null)}
          error={error}
          data-autofocus
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          icon={q.kind === "url" ? <IconLink size={20} /> : <IconPlus size={20} />}
        />
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? "Kaydediliyor…" : actionLabel(q, !!known)}
          {!busy && q.kind !== "name" && q.kind !== "empty" && <IconArrowRight size={18} />}
        </Button>
        <Link href={detailed} className={s.detailed}>
          Ayrıntılı tarif yaz
        </Link>
      </form>
    </Dialog>
  );
}
