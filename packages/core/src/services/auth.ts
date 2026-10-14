import { t } from "../i18n";
import { z } from "zod";
import type { Repos } from "../data/repos";
import type { SessionStore } from "../data/session";
import type { User } from "../data/models";
import { hashPassword, randomSalt, verifyPassword } from "../lib/crypto";
import { AppError } from "./errors";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, { error: () => t("auth.err.name") }).max(40, { error: () => t("auth.err.nameLong") }),
  email: z.string().trim().email({ error: () => t("auth.err.email") }),
  password: z.string().min(6, { error: () => t("auth.err.password") }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  email: z.string().trim().email({ error: () => t("auth.err.email") }),
  password: z.string().min(1, { error: () => t("auth.err.passwordMissing") }),
});

export function initialOf(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase("tr") || "?";
}

function firstIssue(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Bilgilerde eksik var.";
}

export async function signUp(repos: Repos, session: SessionStore, input: SignUpInput): Promise<User> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid", firstIssue(parsed.error));
  const { name, email, password } = parsed.data;
  if (await repos.auth.findUserByEmail(email)) {
    throw new AppError("duplicate", t("auth.err.duplicate"));
  }
  const salt = randomSalt();
  const user = await repos.auth.createUser({
    email: email.toLowerCase(),
    name,
    avatarInitial: initialOf(name),
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    onboarded: false,
  });
  session.set(user.id);
  return user;
}

export async function logIn(repos: Repos, session: SessionStore, input: { email: string; password: string }): Promise<User> {
  const parsed = logInSchema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid", firstIssue(parsed.error));
  const user = await repos.auth.findUserByEmail(parsed.data.email);
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordSalt, user.passwordHash) : false;
  if (!user || !ok) throw new AppError("credentials", t("auth.err.credentials"));
  session.set(user.id);
  return user;
}

export function logOut(session: SessionStore): void {
  session.clear();
}

export async function currentUser(repos: Repos, session: SessionStore): Promise<User | null> {
  const id = session.get();
  if (!id) return null;
  const user = await repos.auth.getUser(id);
  if (!user) session.clear();
  return user;
}
