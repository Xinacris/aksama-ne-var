"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Invite link shown without protocol, like the design ("aksamanevar.app/ev/k7m2-tq"). */
export function useInviteLink(code: string | undefined): { display: string; full: string } {
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  if (!code || !origin) return { display: "", full: "" };
  const full = `${origin}/ev/${code}`;
  return { display: full.replace(/^https?:\/\//, ""), full };
}
