"use client";

import { t } from "@anv/core/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SignUpForm } from "@/components/AuthForms";
import { AuthProviders, SHOW_AUTH_PROVIDERS } from "@/components/AuthProviders";
import { Loading } from "@/components/Guard";
import { shell, SimpleShell } from "@/components/SimpleShell";
import { useApp } from "@/store/app";

export default function KayitPage() {
  const router = useRouter();
  const status = useApp((s) => s.status);
  const createHousehold = useApp((s) => s.createHousehold);
  const signingUp = useRef(false);

  useEffect(() => {
    if (signingUp.current) return;
    if (status === "ready") router.replace("/bugun");
    else if (status === "no-household") router.replace("/onboarding/1");
  }, [status, router]);

  return (
    <SimpleShell aside={t("kayit.aside")}>
      {status === "booting" ? (
        <Loading />
      ) : (
        <main className={shell.narrow}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 className={shell.title}>{t("kayit.title")}</h1>
            <p className={shell.lead}>{t("kayit.lead")}</p>
          </div>
          <AuthProviders />
          {SHOW_AUTH_PROVIDERS && (
            <>
              <div className={shell.divider}>{t("giris.or")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 className={shell.subtitle}>{t("auth.continueLocal")}</h2>
                <p className={shell.note} style={{ textAlign: "left" }}>
                  {t("auth.continueLocalNote")}
                </p>
              </div>
            </>
          )}
          <SignUpForm
            onDone={async () => {
              signingUp.current = true;
              await createHousehold();
              await useApp.getState().refresh();
              router.replace("/onboarding/1");
            }}
          />
          <p className={shell.alt}>
            {t("kayit.haveAccount")} <Link href="/giris">{t("auth.signIn")}</Link>
          </p>
        </main>
      )}
    </SimpleShell>
  );
}
