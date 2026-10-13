import type { Household, Member, User } from "@/data/models";
import type { Repos } from "@/data/repos";
import { AppError } from "./errors";

/** Avatar colors from the design, assigned in join order. */
export const MEMBER_COLORS = ["#55612A", "#9A5512"] as const;
/** The product is built for two people deciding together ("İkiniz de…"). */
export const MAX_MEMBERS = 2;

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Short, readable invite code like the design's "k7m2-tq". */
export function newInviteCode(rand: () => number = Math.random): string {
  const pick = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join("");
  return `${pick(4)}-${pick(2)}`;
}

export function inviteMessage(link: string): string {
  return `Akşama ne yiyeceğimize birlikte karar verelim mi? Bu linkle evime katıl:\n${link}`;
}

export function whatsappShareUrl(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(inviteMessage(link))}`;
}

export async function createHousehold(repos: Repos, user: User): Promise<Household> {
  const existing = await repos.households.membershipOf(user.id);
  if (existing) {
    const h = await repos.households.get(existing.householdId);
    if (h) return h;
  }
  let code = newInviteCode();
  for (let i = 0; i < 5 && (await repos.households.findByInviteCode(code)); i++) code = newInviteCode();
  const household = await repos.households.create({
    name: `${user.name} ve ev halkı`,
    inviteCode: code,
    createdBy: user.id,
    dinnerTime: "19:30",
    lunchAtHome: "yes",
    lunchDays: [],
  });
  await repos.households.addMember({
    householdId: household.id,
    userId: user.id,
    role: "owner",
    color: MEMBER_COLORS[0],
    createdBy: user.id,
  });
  return household;
}

export type InviteLookup =
  | { kind: "ok"; household: Household; members: Member[]; owner: User | null }
  | { kind: "missing" }
  | { kind: "full"; household: Household }
  | { kind: "already-member"; household: Household };

export async function lookupInvite(repos: Repos, code: string, userId: string | null): Promise<InviteLookup> {
  const household = await repos.households.findByInviteCode(code);
  if (!household) return { kind: "missing" };
  const members = await repos.households.listMembers(household.id);
  if (userId && members.some((m) => m.userId === userId)) return { kind: "already-member", household };
  if (members.length >= MAX_MEMBERS) return { kind: "full", household };
  const owner = await repos.auth.getUser(household.createdBy);
  return { kind: "ok", household, members, owner };
}

export async function joinHousehold(repos: Repos, user: User, code: string): Promise<Household> {
  const look = await lookupInvite(repos, code, user.id);
  if (look.kind === "missing") throw new AppError("missing", "Bu davet linki bir eve ait görünmüyor. Linki tekrar isteyebilir misin?");
  if (look.kind === "full") throw new AppError("full", "Bu evde yer kalmamış; iki kişilik bir ev. Ev sahibine haber verebilirsin.");
  if (look.kind === "already-member") return look.household;
  const mine = await repos.households.membershipOf(user.id);
  if (mine) throw new AppError("has-household", "Zaten bir evin var. Önce Ayarlar › Ev bölümünden ayrılman gerekiyor.");
  const members = look.members;
  await repos.households.addMember({
    householdId: look.household.id,
    userId: user.id,
    role: "member",
    color: MEMBER_COLORS.find((c) => !members.some((m) => m.color === c)) ?? MEMBER_COLORS[1],
    createdBy: user.id,
  });
  await repos.activity.add({
    householdId: look.household.id,
    actorId: user.id,
    type: "household.joined",
    data: {},
    createdBy: user.id,
  });
  return look.household;
}

/** Leave the household. The last member leaving keeps the data dormant (no hard delete). */
export async function leaveHousehold(repos: Repos, user: User): Promise<void> {
  const m = await repos.households.membershipOf(user.id);
  if (m) await repos.households.removeMember(m.id);
}

/** Members' user rows in join order, each with its avatar color. */
export async function householdPeople(repos: Repos, householdId: string): Promise<{ members: Member[]; users: User[] }> {
  const members = await repos.households.listMembers(householdId);
  const users = await repos.auth.listUsers(members.map((m) => m.userId));
  const ordered = members.map((m) => users.find((u) => u.id === m.userId)).filter((u): u is User => !!u);
  return { members, users: ordered };
}
