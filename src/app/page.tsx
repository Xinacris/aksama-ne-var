"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/components/Guard";
import { useApp } from "@/store/app";

export default function Home() {
  const status = useApp((s) => s.status);
  const router = useRouter();
  useEffect(() => {
    if (status === "anon") router.replace("/giris");
    else if (status === "no-household") router.replace("/onboarding/1");
    else if (status === "ready") router.replace("/bugun");
  }, [status, router]);
  return (
    <main>
      <h1 className="visually-hidden">Akşama ne var?</h1>
      <Loading />
    </main>
  );
}
