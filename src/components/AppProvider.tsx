"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { onCorruptData } from "@/data";
import { STORAGE_ERROR_MESSAGE } from "@/data/storage";
import { useApp } from "@/store/app";
import { Notice } from "./ui/Misc";

/** Boots the client store once, tracks the route for presence, shows calm notices. */
export function AppProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const notice = useApp((s) => s.notice);
  const dismiss = useApp((s) => s.dismissNotice);

  useEffect(() => {
    const off = onCorruptData(() => useApp.getState().setNotice({ kind: "error", text: STORAGE_ERROR_MESSAGE.corrupt }));
    void useApp.getState().boot();
    // Keep "today" fresh across midnight.
    const t = setInterval(() => void useApp.getState().refresh(), 60_000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    useApp.getState().setRoute(pathname ?? "/");
  }, [pathname]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismiss, notice.kind === "error" ? 9000 : 4500);
    return () => clearTimeout(t);
  }, [notice, dismiss]);

  return (
    <>
      {children}
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={dismiss} />}
    </>
  );
}
