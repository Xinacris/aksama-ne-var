"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SignUpForm } from "@/components/AuthForms";
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
    <SimpleShell aside="Yeni hesap">
      {status === "booting" ? (
        <Loading />
      ) : (
        <main className={shell.narrow}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 className={shell.title}>Akşam yemeğini dert etmeyin</h1>
            <p className={shell.lead}>Bir hesap aç, sık yaptığınız yemekleri seç, sonra eşini ya da ev arkadaşını çağır.</p>
          </div>
          <SignUpForm
            onDone={async () => {
              signingUp.current = true;
              await createHousehold();
              await useApp.getState().refresh();
              router.replace("/onboarding/1");
            }}
          />
          <p className={shell.alt}>
            Zaten hesabın var mı? <Link href="/giris">Giriş yap</Link>
          </p>
        </main>
      )}
    </SimpleShell>
  );
}
