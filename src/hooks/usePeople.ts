"use client";

import { useMemo } from "react";
import type { AvatarPerson } from "@/components/ui/Avatar";
import { MEMBER_COLORS } from "@/services/household";
import { useApp } from "@/store/app";

/** Household members as avatar-ready people, in join order. */
export function usePeople(): { people: AvatarPerson[]; byId: Map<string, AvatarPerson>; me: AvatarPerson | null; partner: AvatarPerson | null } {
  const users = useApp((s) => s.people);
  const members = useApp((s) => s.members);
  const meUser = useApp((s) => s.me);
  return useMemo(() => {
    const people = users.map((u, i) => ({
      id: u.id,
      name: u.name,
      initial: u.avatarInitial,
      color: members.find((m) => m.userId === u.id)?.color ?? MEMBER_COLORS[i] ?? MEMBER_COLORS[0],
    }));
    const byId = new Map(people.map((p) => [p.id, p]));
    const me =
      (meUser && byId.get(meUser.id)) ??
      (meUser ? { id: meUser.id, name: meUser.name, initial: meUser.avatarInitial, color: MEMBER_COLORS[0] } : null);
    const partner = people.find((p) => p.id !== meUser?.id) ?? null;
    return { people, byId, me, partner };
  }, [users, members, meUser]);
}
