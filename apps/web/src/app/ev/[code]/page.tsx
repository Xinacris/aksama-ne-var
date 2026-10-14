"use client";

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
      <SimpleShell aside="Davet">
        <Loading />
      </SimpleShell>
    );
  }

  if (info.kind === "missing" || info.kind === "full") {
    return (
      <SimpleShell aside="Davet">
        <main className={shell.narrow}>
          <h1 className="visually-hidden">Davet</h1>
          <EmptyState
            title={info.kind === "missing" ? "Bu davet bir eve ait görünmüyor" : "Bu ev şu an dolu"}
            text={
              info.kind === "missing"
                ? "Link eksik kopyalanmış olabilir. Davet edenden linki bir daha göndermesini isteyebilirsin."
                : "Akşama ne var? iki kişinin birlikte karar vermesi için. Kendi evini kurup istediğin kişiyi çağırabilirsin."
            }
            actions={
              <>
                <ButtonLink href={me ? "/bugun" : "/kayit"} size="sm">
                  {me ? "Kendi evime dön" : "Kendi evimi kur"}
                </ButtonLink>
                {!me && (
                  <ButtonLink href="/giris" size="sm" variant="secondary">
                    Giriş yap
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
      <SimpleShell aside="Davet">
        <main className={shell.narrow}>
          <h1 className={shell.title}>Zaten bu evdesin</h1>
          <p className={shell.lead}>
            {me ? `${me.name} olarak girişlisin. ` : ""}Menü, liste ve hatırlatmalar seni bekliyor.
          </p>
          <ButtonLink href="/bugun" size="xl" block>
            Bugüne git
          </ButtonLink>
          <Button variant="secondary" size="lg" block onClick={switchAccount}>
            Farklı bir hesapla katıl
          </Button>
          <p className={shell.note}>Aynı tarayıcıda ikinci kişi olarak denemek için: bu sekmede çıkış yapılır, diğer sekme açık kalır.</p>
        </main>
      </SimpleShell>
    );
  }

  const owner = info.owner;
  const ownerPerson = { name: owner?.name ?? "Ev sahibi", initial: owner?.avatarInitial ?? "?", color: MEMBER_COLORS[0] };
  const hasOtherHousehold = status === "ready" && household && household.id !== info.household.id;

  return (
    <SimpleShell aside="Davet">
      <main className={s.main}>
        <section className={s.left}>
          <div className={s.avatars}>
            <Avatar person={ownerPerson} size={56} style={{ border: "3px solid var(--bg)" }} />
            <InviteAvatar>
              <IconPlus size={22} />
            </InviteAvatar>
          </div>
          <div className={s.intro}>
            <h1 className={shell.title}>{ownerPerson.name} seni evine çağırıyor</h1>
            <p className={shell.lead}>
              Akşam kararını birlikte verin. Eşleşmeler, alışveriş listesi ve hatırlatmalar ikinizde aynı anda güncellenir.
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
                  Zaten bir evin var. Bu eve katılmak için önce Ayarlar › Ev bölümünden mevcut evinden ayrılman gerekiyor.
                </p>
                <ButtonLink href="/ayarlar" size="lg" variant="outlineInk" block>
                  Ayarlara git
                </ButtonLink>
                <Button variant="secondary" size="lg" block onClick={switchAccount}>
                  Farklı bir hesapla katıl
                </Button>
              </div>
            ) : (
              <div className={s.stack}>
                <Button size="xl" block onClick={join} disabled={busy}>
                  {busy ? "Katılıyorsun…" : `${me.name} olarak eve katıl`}
                </Button>
                <Button variant="secondary" size="lg" block onClick={switchAccount}>
                  Farklı bir hesapla katıl
                </Button>
              </div>
            )
          ) : mode === "signup" ? (
            <div className={s.stack}>
              <SignUpForm onDone={join} submitLabel="Hesap oluştur ve katıl" />
              <p className={shell.alt}>
                Hesabın var mı?{" "}
                <button type="button" className={s.linkBtn} onClick={() => setMode("login")}>
                  Giriş yap ve katıl
                </button>
              </p>
            </div>
          ) : (
            <div className={s.stack}>
              <LogInForm onDone={join} />
              <p className={shell.alt}>
                Yeni misin?{" "}
                <button type="button" className={s.linkBtn} onClick={() => setMode("signup")}>
                  Hesap oluştur
                </button>
              </p>
            </div>
          )}
        </section>

        <aside aria-label="Evin sık yaptıkları" className={s.aside}>
          <span className={s.eyebrow}>Bu evde sık yapılanlar</span>
          <div className={s.card}>
            {info.favorites.length ? (
              <>
                <span className={s.cardNote}>Katıldığında bu {info.favorites.length} yemek senin kartlarına da gelir:</span>
                <div className={s.chips}>
                  {info.favorites.map((r) => (
                    <span key={r.id} className={s.chip}>
                      {recipeLabel(r)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <span className={s.cardNote}>Henüz seçilmiş yemek yok; katıldıktan sonra birlikte seçersiniz.</span>
            )}
          </div>
          <Link href="/" className={s.small}>
            Akşama ne var? nedir?
          </Link>
        </aside>
      </main>
    </SimpleShell>
  );
}
