"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Loading } from "@/components/Guard";
import { ImportSourceCard } from "@/components/ImportSourceCard";
import { RecipeForm } from "@/components/RecipeForm";
import { IconChevronLeft, IconLink } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { extractUrl } from "@/domain/import/detect";
import type { ImportPath, ImportResult } from "@/domain/import/types";
import type { SourcePlatform } from "@/data/models";
import { toRecipeDraft } from "@/services/importDraft";
import type { RecipeDraft } from "@/services/recipeForm";
import { useApp } from "@/store/app";
import s from "./page.module.css";

type ApiResponse = ImportResult & { error?: string; counted?: { platform: SourcePlatform | null; path: ImportPath } | null };

function Ice() {
  const router = useRouter();
  const params = useSearchParams();
  const household = useApp((x) => x.household);
  const createRecipe = useApp((x) => x.createRecipe);
  const logImport = useApp((x) => x.logImport);
  // Web Share Target: Android puts the link in `url` or inside `text`.
  const sharedText = params.get("text") ?? "";
  const sharedUrl = params.get("url") || extractUrl(sharedText) || "";
  const [url, setUrl] = useState(sharedUrl);
  const [text, setText] = useState(sharedText && extractUrl(sharedText) === sharedText.trim() ? "" : sharedText.replace(sharedUrl, "").trim());
  const [pasteOpen, setPasteOpen] = useState(!!text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const auto = useRef(false);
  const [focusPaste, setFocusPaste] = useState(0);

  // Move focus into the paste box once it is rendered (after a "needs paste" answer).
  useEffect(() => {
    if (focusPaste) pasteRef.current?.focus();
  }, [focusPaste]);

  async function run() {
    if (!url.trim() && !text.trim()) {
      setError("Bir link yapıştır ya da tarifin metnini aşağıya bırak.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), text: text.trim(), householdId: household?.id ?? "" }),
      });
      const body = (await res.json()) as ApiResponse;
      if (!res.ok || body.error) {
        setError(body.error ?? "Şu an taslak çıkaramadık. Biraz sonra yeniden dener misin?");
        setPasteOpen(true);
        return;
      }
      setResult(body);
      if (body.counted) await logImport({ platform: body.counted.platform, path: body.counted.path });
      if (body.needsPaste) {
        setPasteOpen(true);
        setDraft(null);
        setFocusPaste((n) => n + 1);
      } else if (body.draft) {
        setDraft(toRecipeDraft(body.draft, body.source));
        setAttempt((n) => n + 1);
        window.scrollTo({ top: 0 });
      }
    } catch {
      setError("Bağlantı kurulamadı. İnternetin geri gelince yeniden deneyebilir ya da metni yapıştırabilirsin.");
      setPasteOpen(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (auto.current || !household || (!sharedUrl && !sharedText)) return;
    auto.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for a shared link
  }, [household]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void run();
  }

  if (draft && result) {
    return (
      <RecipeForm
        key={attempt}
        title="Taslağı kontrol et"
        initial={draft}
        backHref="/tarifler/ice-aktar"
        backLabel="Başka link"
        submitLabel="Tarifi kaydet"
        header={
          <div className={s.review}>
            {result.source?.url && <ImportSourceCard source={result.source} />}
            <p className={s.check} role="status">
              <strong>Kontrol edip kaydet.</strong>{" "}
              {result.path === "llm"
                ? "Açıklamadan biz çıkardık; miktarlara ve adımlara bir göz at."
                : "Açıklamayı basitçe okuduk; eksik kalan malzeme ya da adım varsa buradan tamamlayabilirsin."}
            </p>
            <button
              type="button"
              className={s.toggle}
              onClick={() => {
                setDraft(null);
                setPasteOpen(true);
                setFocusPaste((n) => n + 1);
              }}
            >
              Açıklamayı yeniden yapıştır
            </button>
          </div>
        }
        onSubmit={async (value) => {
          const r = await createRecipe(value, { imported: true });
          if (r) router.push(`/tarif/${r.id}`);
        }}
      />
    );
  }

  return (
    <main className={s.page}>
      <Link href="/tarifler" className={s.back}>
        <IconChevronLeft size={20} />
        Tarifler
      </Link>
      <div className={s.titles}>
        <h1 className={s.title}>Linkten ekle</h1>
        <p className={s.lead}>Instagram, YouTube ya da TikTok&apos;taki bir tarifin linkini yapıştır. Açıklamadan bir taslak çıkarırız; sen kontrol edip kaydedersin.</p>
      </div>

      <form onSubmit={submit} className={s.card} noValidate>
        <TextField
          label="Link"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.instagram.com/reel/…"
          icon={<IconLink size={18} />}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        {result?.source?.url && <ImportSourceCard source={result.source} />}
        {result?.message && (
          <p className={s.message} role="status">
            {result.message}
          </p>
        )}

        <div className={s.paste}>
          <button type="button" className={s.toggle} aria-expanded={pasteOpen} aria-controls="aciklama" onClick={() => setPasteOpen((v) => !v)}>
            {pasteOpen ? "Açıklama kutusunu gizle" : "Açıklamayı yapıştırmak istiyorum"}
          </button>
          {pasteOpen && (
            <div id="aciklama">
              <TextArea
                ref={pasteRef}
                label="Açıklamayı buraya yapıştır"
                hint="Videonun altındaki açıklamayı ya da tarif metnini kopyalayıp buraya bırak. Link olmadan da olur."
                rows={8}
                maxLength={8000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Taslak hazırlanıyor…" : "Taslağı çıkar"}
        </Button>
        {busy && (
          <span className="visually-hidden" role="status">
            Taslak hazırlanıyor
          </span>
        )}
      </form>
      <p className={s.note}>Kaydetmeden önce her şeyi değiştirebilirsin. Tarifin kaynağı ve hazırlayanı tarif sayfasında görünür.</p>
    </main>
  );
}

export default function IceAktarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Ice />
    </Suspense>
  );
}
