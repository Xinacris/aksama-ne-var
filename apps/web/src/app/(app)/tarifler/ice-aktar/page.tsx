"use client";

import { getLocale, t } from "@anv/core/i18n";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Loading } from "@/components/Guard";
import { ImportSourceCard } from "@/components/ImportSourceCard";
import { RecipeForm } from "@/components/RecipeForm";
import { IconChevronLeft, IconLink } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { extractUrl } from "@anv/core/domain/import/detect";
import type { ImportProvider, ImportResult } from "@anv/core/domain/import/types";
import type { SourcePlatform } from "@anv/core/data/models";
import { keepSource, toRecipeDraft } from "@anv/core/services/importDraft";
import type { RecipeDraft } from "@anv/core/services/recipeForm";
import { useApp } from "@/store/app";
import s from "./page.module.css";

type ApiResponse = ImportResult & { error?: string; counted?: { platform: SourcePlatform | null; provider: ImportProvider } | null };

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
  // Tags of the draft being replaced ("Açıklamayı yeniden yapıştır"): kept, new ones merged in.
  const lastTags = useRef("");

  // Move focus into the paste box once it is rendered (after a "needs paste" answer).
  useEffect(() => {
    if (focusPaste) pasteRef.current?.focus();
  }, [focusPaste]);

  async function run() {
    if (!url.trim() && !text.trim()) {
      setError(t("import.needLink"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), text: text.trim(), householdId: household?.id ?? "", locale: getLocale() }),
      });
      const body = (await res.json()) as ApiResponse;
      if (!res.ok || body.error) {
        setError(body.error ?? t("import.failed"));
        setPasteOpen(true);
        return;
      }
      const source = keepSource(result?.source ?? null, body.source);
      setResult({ ...body, source });
      if (body.counted) await logImport({ platform: body.counted.platform, provider: body.counted.provider });
      if (body.needsPaste) {
        setPasteOpen(true);
        setDraft(null);
        setFocusPaste((n) => n + 1);
      } else if (body.draft) {
        setDraft({
          ...toRecipeDraft(body.draft, source, lastTags.current, body.writtenRecipeUrl ?? null),
          ...(body.sourceLang ? { sourceLang: body.sourceLang } : {}),
          ...(body.sourceText ? { sourceText: body.sourceText } : {}),
        });
        lastTags.current = "";
        setAttempt((n) => n + 1);
        window.scrollTo({ top: 0 });
      }
    } catch {
      setError(t("import.offline"));
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
        title={t("import.checkTitle")}
        initial={draft}
        backHref="/tarifler/ice-aktar"
        backLabel={t("import.anotherLink")}
        submitLabel={t("form.saveRecipe")}
        header={
          <div className={s.review}>
            {result.source?.url && <ImportSourceCard source={result.source} />}
            <p className={s.check} role="status">
              <strong>{t("import.checkSave")}</strong>{" "}
              {result.provider === "web"
                ? result.writtenRecipeUrl
                  ? t("import.fromWritten")
                  : t("import.fromPage")
                : result.path === "llm"
                  ? t("import.fromLlm")
                  : t("import.fromRules")}
            </p>
            {result.draft && result.draft.steps.length === 0 && (
              <p className={s.noSteps} role="note">
                {t("import.noSteps")}
              </p>
            )}
            <button
              type="button"
              className={s.toggle}
              onClick={() => {
                lastTags.current = draft.tags;
                setDraft(null);
                setPasteOpen(true);
                setFocusPaste((n) => n + 1);
              }}
            >
              {t("import.repaste")}
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
        {t("import.back")}
      </Link>
      <div className={s.titles}>
        <h1 className={s.title}>{t("import.title")}</h1>
        <p className={s.lead}>{t("import.lead")}</p>
      </div>

      <form onSubmit={submit} className={s.card} noValidate>
        <TextField
          label={t("import.link")}
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
            {pasteOpen ? t("import.hidePaste") : t("import.showPaste")}
          </button>
          {pasteOpen && (
            <div id="aciklama">
              <TextArea
                ref={pasteRef}
                label={t("import.pasteLabel")}
                hint={t("import.pasteHint")}
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
          {busy ? t("import.working") : t("import.go")}
        </Button>
        {busy && (
          <span className="visually-hidden" role="status">
            {t("import.workingSr")}
          </span>
        )}
      </form>
      <p className={s.note}>{t("import.note")}</p>
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
