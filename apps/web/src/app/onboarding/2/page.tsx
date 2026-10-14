"use client";

import { t } from "@anv/core/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Guard, Loading } from "@/components/Guard";
import { IconLink, IconMessage, IconPlus } from "@/components/icons";
import { SimpleShell } from "@/components/SimpleShell";
import { Avatar, InviteAvatar } from "@/components/ui/Avatar";
import { useInviteLink } from "@/hooks/useInviteLink";
import { usePeople } from "@/hooks/usePeople";
import { recipesMap, useApp } from "@/store/app";
import { recipeLabel } from "@anv/core/domain/shopping";
import { inviteMessage, whatsappShareUrl } from "@anv/core/services/household";
import s from "../onboarding.module.css";

function Step2() {
  const router = useRouter();
  const status = useApp((st) => st.status);
  const household = useApp((st) => st.household);
  const favorites = useApp((st) => st.favorites);
  const recipes = useApp((st) => st.recipes);
  const completeOnboarding = useApp((st) => st.completeOnboarding);
  const setNotice = useApp((st) => st.setNotice);
  const { me, partner } = usePeople();
  const link = useInviteLink(household?.inviteCode);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(t);
  }, [copied]);

  if (status !== "ready" || !household || !me) return <Loading />;

  const byId = recipesMap(recipes);
  const favRecipes = favorites.map((f) => byId.get(f.recipeId)).filter((r) => !!r);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.full);
      setCopied(true);
    } catch {
      inputRef.current?.select();
      setNotice({ kind: "info", text: t("onb2.copyFailed") });
    }
  }

  async function start() {
    await completeOnboarding();
    router.push("/bugun");
  }

  return (
    <SimpleShell aside={t("onb2.step")}>
      <main className={s.main2}>
        <section className={s.left}>
          <div className={s.avatars}>
            <Avatar person={me} size={56} style={{ border: "3px solid var(--bg)" }} />
            {partner ? (
              <Avatar person={partner} size={56} style={{ border: "3px solid var(--bg)" }} />
            ) : (
              <InviteAvatar>
                <IconPlus size={22} />
              </InviteAvatar>
            )}
          </div>
          <div className={s.intro}>
            <h1 className={s.title}>{t("onb2.title")}</h1>
            <p className={s.lead}>
              {t("onb2.lead")}
            </p>
          </div>

          {partner ? (
            <p className={s.joined} role="status">
              <strong>{partner.name}</strong> {t("onb2.joined")}
            </p>
          ) : (
            <div className={s.field}>
              <label htmlFor="davet-linki" className={s.label}>
                {t("onb2.inviteLink")}
              </label>
              <div className={s.linkBox}>
                <span className={s.linkIcon}>
                  <IconLink size={18} />
                </span>
                <input id="davet-linki" ref={inputRef} type="text" readOnly value={link.display} className={s.linkInput} onFocus={(e) => e.target.select()} />
                <button type="button" className={s.copy} onClick={copy} aria-live="polite">
                  {copied ? t("onb2.copied") : t("onb2.copy")}
                </button>
              </div>
            </div>
          )}

          <div className={s.actions}>
            {partner ? (
              <button type="button" className={s.wa} onClick={start}>
                {t("onb2.letsGo")}
              </button>
            ) : (
              <>
                <a className={s.wa} href={whatsappShareUrl(link.full)} target="_blank" rel="noopener noreferrer">
                  <IconMessage size={20} />
                  {t("onb2.whatsapp")}
                </a>
                <button type="button" className={s.solo} onClick={start}>
                  {t("onb2.solo")}
                </button>
              </>
            )}
            <p className={s.small}>{t("onb2.soloNote")}</p>
          </div>
        </section>

        <aside aria-label={t("onb2.preview")} className={s.aside}>
          <span className={s.asideTitle}>{t("onb2.message")}</span>
          <div className={s.card}>
            <div className={s.bubble}>
              {inviteMessage("").trim()}
              <br />
              <span className={s.bubbleLink}>{link.display}</span>
            </div>
            <div className={s.cardFoot}>
              <span className={s.cardNote}>
                {favRecipes.length
                  ? t("onb2.favsCome", { count: favRecipes.length })
                  : t("onb2.noFavs")}
              </span>
              {favRecipes.length > 0 && (
                <div className={s.favs}>
                  {favRecipes.map((r) => (
                    <span key={r!.id} className={s.fav}>
                      {recipeLabel(r!)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Link href="/onboarding/1" className={s.edit}>
            {t("onb2.editPicks")}
          </Link>
        </aside>
      </main>
    </SimpleShell>
  );
}

export default function OnboardingStep2() {
  return (
    <Guard need="household">
      <Step2 />
    </Guard>
  );
}
