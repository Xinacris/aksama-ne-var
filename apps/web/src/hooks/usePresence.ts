"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/store/app";
import { usePeople } from "./usePeople";
import type { AvatarPerson } from "@/components/ui/Avatar";

const FRESH_MS = 12_000;

/** The partner if they have a tab open right now (optionally on a given route). */
export function usePartnerPresence(route?: string): AvatarPerson | null {
  const presence = useApp((s) => s.presence);
  const { byId, partner } = usePeople();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 4000);
    return () => clearInterval(t);
  }, []);
  void tick;
  if (!partner) return null;
  const p = presence[partner.id];
  // eslint-disable-next-line react-hooks/purity -- presence freshness is time-based by nature
  if (!p || Date.now() - p.at > FRESH_MS) return null;
  if (route && !p.route.startsWith(route)) return null;
  return byId.get(partner.id) ?? null;
}
