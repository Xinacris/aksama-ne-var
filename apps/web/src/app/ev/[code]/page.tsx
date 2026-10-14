"use client";

import { t } from "@anv/core/i18n";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogInForm, SignUpForm } from "@/components/AuthForms";
import { Loading } from "@/components/Guard";
import { shell, SimpleShell } from "@/components/SimpleShell";
import { IconPlus } from "@/components/icons";
import { Avatar, InviteAvatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { messageOf } from "@anv/core/services/errors";
import { MEMBER_COLORS } from "@anv/core/services/household";
import { recipeLabel } from "@anv/core/domain/shopping";
import { useApp, type InviteInfo } from "@/store/app";
import s from "./page.module.css";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const status = useApp((st) => st.status);
  const me = useApp((st) => st.me);
  const household = useApp((st) => st.household);
  const lookupInvite = useApp((st) => st.lookupInvite);
  const joinHousehold = useApp((st) => st.joinHousehold);
  const logOut = useApp((st) => st.logOut);
  const switchAccount = () => {
    logOut();
    setInfo(null);
  };
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "booting") return;
    let alive = true;
    void lookupInvite(code).then((r) => alive && setInfo(r));
    return () => {
      alive = false;
    };
  }, [code, status, me?.id, lookupInvite]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await joinHousehold(code);
      router.replace("/onboarding/1?katil=1");
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  if (status === "booting" || !info) {
    return (
      <SimpleShell aside={t("invite.aside")}>
        <Loading />
      </SimpleShell>
    );
  }

  if (info.kind === "missing" || info.kind === "full") {
    return (
      <SimpleShell aside={t("invite.aside")}>
        <main className={shell.narrow}>
          <h1 className="visually-hidden">{t("invite.aside")}</h1>
          <EmptyState
            title={info.kind === "missing" ? t("invite.missingTitle") : t("invite.fullTitle")}
            text={
              info.kind === "missing"
                ? t("invite.missingText")
                : t("invite.fullText")
            }
            actions={
              <>
                <ButtonLink href={me ? "/bugun" : "/kayit"} size="sm">
                  {me ? t("invite.backHome") : t("invite.setUp")}
                </ButtonLink>
                {!me && (
                  <ButtonLink href="/giris" size="sm" variant="secondary">
                    {t("auth.signIn")}
                  </ButtonLink>
                )}
              </>
            }
          />
        </main>
      </SimpleShell>
    );
  }

  if (info.kind === "already-member") {
    return (
      <SimpleShell aside={t("invite.aside")}>
        <main className={shell.narrow}>
          <h1 className={shell.title}>{t("invite.alreadyTitle")}</h1>
          <p className={shell.lead}>
            {me ? t("invite.signedInAs", { name: me.name }) : ""}
            {t("invite.waiting")}
          </p>
          <ButtonLink href="/bugun" size="xl" block>
            {t("invite.toToday")}
          </ButtonLink>
          <Button variant="secondary" size="lg" block onClick={switchAccount}>
            {t("invite.otherAccount")}
          </Button>
          <p className={shell.note}>{t("invite.sameBrowser")}</p>
        </main>
      </SimpleShell>
    );
  }

  const owner = info.owner;
  const ownerPerson = { name: owner?.name ?? t("invite.owner"), initial: owner?.avatarInitial ?? "?", color: MEMBER_COLORS[0] };
  const hasOtherHousehold = status === "ready" && household && household.id !== info.household.id;

  return (
    <SimpleShell aside={t("invite.aside")}>
      <main className={s.main}>
        <section className={s.left}>
          <div className={s.avatars}>
            <Avatar person={ownerPerson} size={56} style={{ border: "3px solid var(--bg)" }} />
            <InviteAvatar>
              <IconPlus size={22} />
            </InviteAvatar>
          </div>
          <div className={s.intro}>
            <h1 className={shell.title}>{t("invite.title", { name: ownerPerson.name })}</h1>
            <p className={shell.lead}>
              {t("invite.lead")}
            </p>
          </div>

          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}

          {me ? (
            hasOtherHousehold ? (
              <div className={s.stack}>
                <p className={shell.lead}>
                  {t("invite.hasOther")}
                </p>
                <ButtonLink href="/ayarlar" size="lg" variant="outlineInk" block>
                  {t("invite.toSettings")}
                </ButtonLink>
                <Button variant="secondary" size="lg" block onClick={switchAccount}>
                  {t("invite.otherAccount")}
                </Button>
              </div>
            ) : (
              <div className={s.stack}>
                <Button size="xl" block onClick={join} disabled={busy}>
                  {busy ? t("invite.joining") : t("invite.joinAs", { name: me.name })}
                </Button>
                <Button variant="secondary" size="lg" block onClick={switchAccount}>
                  {t("invite.otherAccount")}
                </Button>
              </div>
            )
          ) : mode === "signup" ? (
            <div className={s.stack}>
              <SignUpForm onDone={join} submitLabel={t("invite.signUpJoin")} />
              <p className={shell.alt}>
                {t("invite.haveAccount")}{" "}
                <button type="button" className={s.linkBtn} onClick={() => setMode("login")}>
                  {t("invite.logInJoin")}
                </button>
              </p>
            </div>
          ) : (
            <div className={s.stack}>
              <LogInForm onDone={join} />
              <p className={shell.alt}>
                {t("invite.new")}{" "}
                <button type="button" className={s.linkBtn} onClick={() => setMode("signup")}>
                  {t("auth.createAccount")}
                </button>
              </p>
            </div>
          )}
        </section>

        <aside aria-label={t("invite.favsRegion")} className={s.aside}>
          <span className={s.eyebrow}>{t("invite.favsTitle")}</span>
          <div className={s.card}>
            {info.favorites.length ? (
              <>
                <span className={s.cardNote}>{t("invite.favsCome", { count: info.favorites.length })}</span>
                <div className={s.chips}>
                  {info.favorites.map((r) => (
                    <span key={r.id} className={s.chip}>
                      {recipeLabel(r)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <span className={s.cardNote}>{t("invite.noFavs")}</span>
            )}
          </div>
          <Link href="/" className={s.small}>
            {t("invite.what")}
          </Link>
        </aside>
      </main>
    </SimpleShell>
  );
}
