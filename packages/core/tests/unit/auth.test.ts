import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryData, type DataContext } from "@/data/context";
import { hashPassword, randomSalt, verifyPassword } from "@/lib/crypto";
import { currentUser, logIn, logOut, signUp } from "@/services/auth";
import {
  createHousehold,
  householdPeople,
  inviteMessage,
  joinHousehold,
  leaveHousehold,
  lookupInvite,
  newInviteCode,
  whatsappShareUrl,
} from "@/services/household";

let d: DataContext;
beforeEach(() => {
  d = createMemoryData();
});

const ali = { name: "Ali", email: "ali@ornek.com", password: "kofte123" };
const zeynep = { name: "Zeynep", email: "zeynep@ornek.com", password: "karniyarik" };

describe("password hashing", () => {
  it("hashes with a per-user salt and verifies", async () => {
    const s1 = randomSalt();
    const s2 = randomSalt();
    expect(s1).not.toBe(s2);
    const h1 = await hashPassword("gizli", s1);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPassword("gizli", s2)).not.toBe(h1);
    expect(await verifyPassword("gizli", s1, h1)).toBe(true);
    expect(await verifyPassword("yanlis", s1, h1)).toBe(false);
  });
});

describe("auth", () => {
  it("signs up, persists the session, and never stores the password", async () => {
    const u = await signUp(d.repos, d.session, ali);
    expect(u.avatarInitial).toBe("A");
    expect(JSON.stringify(u)).not.toContain("kofte123");
    expect((await currentUser(d.repos, d.session))?.id).toBe(u.id);
  });

  it("rejects duplicate emails regardless of case", async () => {
    await signUp(d.repos, d.session, ali);
    await expect(signUp(d.repos, d.session, { ...ali, email: "ALI@ornek.com" })).rejects.toThrow(/zaten bir hesap/);
  });

  it("validates input with calm Turkish messages", async () => {
    await expect(signUp(d.repos, d.session, { ...ali, email: "ali" })).rejects.toThrow(/e-posta/);
    await expect(signUp(d.repos, d.session, { ...ali, password: "123" })).rejects.toThrow(/en az 6/);
    await expect(signUp(d.repos, d.session, { ...ali, name: "  " })).rejects.toThrow(/Adını/);
  });

  it("logs in with the right password and refuses the wrong one", async () => {
    await signUp(d.repos, d.session, ali);
    logOut(d.session);
    expect(await currentUser(d.repos, d.session)).toBeNull();
    await expect(logIn(d.repos, d.session, { email: ali.email, password: "yanlis" })).rejects.toThrow(/eşleşmedi/);
    await expect(logIn(d.repos, d.session, { email: "yok@ornek.com", password: "x" })).rejects.toThrow(/eşleşmedi/);
    const u = await logIn(d.repos, d.session, { email: " Ali@Ornek.com ", password: ali.password });
    expect(u.name).toBe("Ali");
  });

  it("clears a session that points at a deleted user", async () => {
    d.session.set("ghost");
    expect(await currentUser(d.repos, d.session)).toBeNull();
    expect(d.session.get()).toBeNull();
  });
});

describe("households and invites", () => {
  it("creates readable invite codes", () => {
    expect(newInviteCode()).toMatch(/^[a-z2-9]{4}-[a-z2-9]{2}$/);
  });

  it("builds the design's invite message and a wa.me link", () => {
    expect(inviteMessage("aksamanevar.app/ev/k7m2-tq")).toBe(
      "Akşama ne yiyeceğimize birlikte karar verelim mi? Bu linkle evime katıl:\naksamanevar.app/ev/k7m2-tq",
    );
    expect(whatsappShareUrl("x")).toMatch(/^https:\/\/wa\.me\/\?text=Ak%C5%9Fama/);
  });

  it("creates a household once and joins a partner via the code", async () => {
    const a = await signUp(d.repos, d.session, ali);
    const h = await createHousehold(d.repos, a);
    expect((await createHousehold(d.repos, a)).id).toBe(h.id);
    const z = await signUp(d.repos, d.session, zeynep);
    const look = await lookupInvite(d.repos, h.inviteCode, z.id);
    expect(look.kind).toBe("ok");
    await joinHousehold(d.repos, z, h.inviteCode.toUpperCase());
    const people = await householdPeople(d.repos, h.id);
    expect(people.users.map((u) => u.name)).toEqual(["Ali", "Zeynep"]);
    expect(people.members.map((m) => m.color)).toEqual(["#55612A", "#9A5512"]);
    const acts = await d.repos.activity.list(h.id);
    expect(acts[0]).toMatchObject({ type: "household.joined", actorId: z.id });
  });

  it("handles nonexistent, full, and already-member invites", async () => {
    const a = await signUp(d.repos, d.session, ali);
    const h = await createHousehold(d.repos, a);
    expect((await lookupInvite(d.repos, "yok-00", null)).kind).toBe("missing");
    expect((await lookupInvite(d.repos, h.inviteCode, a.id)).kind).toBe("already-member");
    const z = await signUp(d.repos, d.session, zeynep);
    await expect(joinHousehold(d.repos, z, "yok-00")).rejects.toThrow(/bir eve ait görünmüyor/);
    await joinHousehold(d.repos, z, h.inviteCode);
    const c = await signUp(d.repos, d.session, { name: "Can", email: "can@ornek.com", password: "123456" });
    expect((await lookupInvite(d.repos, h.inviteCode, c.id)).kind).toBe("full");
    await expect(joinHousehold(d.repos, c, h.inviteCode)).rejects.toThrow(/yer kalmamış/);
  });

  it("refuses to join a second household until you leave", async () => {
    const a = await signUp(d.repos, d.session, ali);
    const h = await createHousehold(d.repos, a);
    const z = await signUp(d.repos, d.session, zeynep);
    await createHousehold(d.repos, z);
    await expect(joinHousehold(d.repos, z, h.inviteCode)).rejects.toThrow(/Zaten bir evin var/);
    await leaveHousehold(d.repos, z);
    await joinHousehold(d.repos, z, h.inviteCode);
    expect((await d.repos.households.membershipOf(z.id))?.householdId).toBe(h.id);
  });
});
