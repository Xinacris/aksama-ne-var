"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LogInForm } from "@/components/AuthForms";
import { Loading } from "@/components/Guard";
import { shell, SimpleShell } from "@/components/SimpleShell";
import { Button } from "@/components/ui/Button";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/services/demo";
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
        <h1 className={shell.title}>Tekrar hoş geldin</h1>
        <p className={shell.lead}>Bu akşamın menüsü, listesi ve hatırlatmaları kaldığın yerde.</p>
      </div>
      <LogInForm onDone={() => {}} />
      <p className={shell.alt}>
        Hesabın yok mu? <Link href="/kayit">Hesap oluştur</Link>
      </p>
      <div className={shell.divider}>ya da</div>
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
        Örnek evle dene · Ali ve Zeynep
      </Button>
      <p className={shell.note}>
        Örnek ev için iki hesap: {DEMO_ACCOUNTS.map((a) => a.email).join(" ve ")} · şifre {DEMO_PASSWORD}
      </p>
    </main>
  );
}

export default function GirisPage() {
  return (
    <SimpleShell aside="Giriş">
      <Suspense fallback={<Loading />}>
        <GirisInner />
      </Suspense>
    </SimpleShell>
  );
}
