"use client";

import { listJoin, t } from "@anv/core/i18n";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LogInForm } from "@/components/AuthForms";
import { AuthProviders } from "@/components/AuthProviders";
import { Loading } from "@/components/Guard";
import { shell, SimpleShell } from "@/components/SimpleShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@anv/core/services/demo";
import { useApp } from "@/store/app";

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/bugun";
}

function GirisInner() {
  const router = useRouter();
  const params = useSearchParams();
  const status = useApp((s) => s.status);
  const loadDemo = useApp((s) => s.loadDemo);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));
  const leaving = params.get("cikis") === "1";
  const logOut = useApp((s) => s.logOut);

  // Logging out goes through /giris?cikis=1 so no guarded page redirects back afterwards.
  useEffect(() => {
    if (leaving && status !== "booting") {
      if (status !== "anon") logOut();
      router.replace("/giris");
    }
  }, [leaving, status, logOut, router]);

  useEffect(() => {
    if (leaving) return;
    if (status === "ready") router.replace(next);
    else if (status === "no-household") router.replace("/onboarding/1");
  }, [status, router, next, leaving]);

  if (status === "booting" || leaving) return <Loading />;

  return (
    <main className={shell.narrow}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 className={shell.title}>{t("giris.title")}</h1>
        <p className={shell.lead}>{t("giris.lead")}</p>
      </div>
      <AuthProviders />
      <ButtonLink href="/kayit" size="lg" block>
        {t("auth.continueLocal")}
      </ButtonLink>
      <p className={shell.note}>{t("auth.continueLocalNote")}</p>
      <div className={shell.divider}>{t("auth.thisDevice")}</div>
      <LogInForm onDone={() => {}} />
      <p className={shell.alt}>
        {t("giris.noAccount")} <Link href="/kayit">{t("auth.createAccount")}</Link>
      </p>
      <div className={shell.divider}>{t("giris.or")}</div>
      <Button
        variant="secondary"
        size="lg"
        block
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await loadDemo();
          router.replace("/bugun");
        }}
      >
        {t("giris.demo")}
      </Button>
      <p className={shell.note}>
        {t("giris.demoNote", { emails: listJoin(DEMO_ACCOUNTS.map((a) => a.email)), password: DEMO_PASSWORD })}
      </p>
    </main>
  );
}

export default function GirisPage() {
  return (
    <SimpleShell aside={t("giris.aside")}>
      <Suspense fallback={<Loading />}>
        <GirisInner />
      </Suspense>
    </SimpleShell>
  );
}
