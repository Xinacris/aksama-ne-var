"use client";

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
      setNotice({ kind: "info", text: "Kopyalayamadık; link seçili, elle kopyalayabilirsin." });
    }
  }

  async function start() {
    await completeOnboarding();
    router.push("/bugun");
  }

  return (
    <SimpleShell aside="Adım 2 / 2">
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
            <h1 className={s.title}>Akşam kararını birlikte verin</h1>
            <p className={s.lead}>
              Eşini ya da ev arkadaşını davet et. Eşleşmeler, alışveriş listesi ve hatırlatmalar ikinizde aynı anda güncellenir.
            </p>
          </div>

          {partner ? (
            <p className={s.joined} role="status">
              <strong>{partner.name}</strong> eve katıldı. Artık kararları birlikte veriyorsunuz.
            </p>
          ) : (
            <div className={s.field}>
              <label htmlFor="davet-linki" className={s.label}>
                Davet linki
              </label>
              <div className={s.linkBox}>
                <span className={s.linkIcon}>
                  <IconLink size={18} />
                </span>
                <input id="davet-linki" ref={inputRef} type="text" readOnly value={link.display} className={s.linkInput} onFocus={(e) => e.target.select()} />
                <button type="button" className={s.copy} onClick={copy} aria-live="polite">
                  {copied ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>
          )}

          <div className={s.actions}>
            {partner ? (
              <button type="button" className={s.wa} onClick={start}>
                Hadi başlayalım
              </button>
            ) : (
              <>
                <a className={s.wa} href={whatsappShareUrl(link.full)} target="_blank" rel="noopener noreferrer">
                  <IconMessage size={20} />
                  WhatsApp ile gönder
                </a>
                <button type="button" className={s.solo} onClick={start}>
                  Şimdilik tek başıma başla
                </button>
              </>
            )}
            <p className={s.small}>Tek başına da her şey çalışır. Davet linki Ayarlar › Ev bölümünde durur; istediğin zaman gönderirsin.</p>
          </div>
        </section>

        <aside aria-label="Mesaj önizlemesi" className={s.aside}>
          <span className={s.asideTitle}>Gönderilecek mesaj</span>
          <div className={s.card}>
            <div className={s.bubble}>
              {inviteMessage("").trim()}
              <br />
              <span className={s.bubbleLink}>{link.display}</span>
            </div>
            <div className={s.cardFoot}>
              <span className={s.cardNote}>
                {favRecipes.length
                  ? `Katıldığında seçtiğin ${favRecipes.length} yemek onun kartlarına da gelir:`
                  : "Henüz yemek seçmedin; birlikte de seçebilirsiniz."}
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
            Seçimleri düzenle
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
