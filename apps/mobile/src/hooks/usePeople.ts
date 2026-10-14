import { useMemo } from "react";
import { MEMBER_COLORS } from "@anv/core/services/household";
import { useApp } from "@/store";
import type { Person } from "@/ui/more";

export type PersonWithId = Person & { id: string };

/** Household members as avatar-ready people, in join order (same as the web hook). */
export function usePeople(): { people: PersonWithId[]; byId: Map<string, PersonWithId>; me: PersonWithId | null; partner: PersonWithId | null } {
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
    const me = (meUser && byId.get(meUser.id)) ?? (meUser ? { id: meUser.id, name: meUser.name, initial: meUser.avatarInitial, color: MEMBER_COLORS[0] } : null);
    const partner = people.find((p) => p.id !== meUser?.id) ?? null;
    return { people, byId, me, partner };
  }, [users, members, meUser]);
}
