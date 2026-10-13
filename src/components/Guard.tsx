"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/store/app";
import s from "./Guard.module.css";

export function Loading({ label = "Mutfağa bakıyoruz…" }: { label?: string }) {
  return (
    <div className={s.loading} role="status">
      <span className={s.dot} aria-hidden="true" />
      {label}
    </div>
  );
}

/**
 * Client-side route protection: anonymous visitors go to /giris,
 * signed-in users without a household go to onboarding.
 */
export function Guard({ need, children }: { need: "auth" | "household"; children: ReactNode }) {
  const status = useApp((st) => st.status);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Keep the query (a shared link arrives as /tarifler/ice-aktar?url=…) through the login.
    if (status === "anon") router.replace(`/giris?next=${encodeURIComponent(`${pathname ?? "/bugun"}${window.location.search}`)}`);
    else if (need === "household" && status === "no-household") router.replace("/onboarding/1");
  }, [status, need, router, pathname]);

  if (status === "booting" || status === "anon") return <Loading />;
  if (need === "household" && status !== "ready") return <Loading />;
  return <>{children}</>;
}
