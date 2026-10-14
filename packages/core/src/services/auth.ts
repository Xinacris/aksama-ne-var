import { z } from "zod";
import type { Repos } from "../data/repos";
import type { SessionStore } from "../data/session";
import type { User } from "../data/models";
import { hashPassword, randomSalt, verifyPassword } from "../lib/crypto";
import { AppError } from "./errors";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Adını yazar mısın?").max(40, "Biraz daha kısa bir ad olsun."),
  email: z.string().trim().email("Bu e-posta adresi eksik görünüyor."),
  password: z.string().min(6, "Şifre en az 6 karakter olsun."),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  email: z.string().trim().email("Bu e-posta adresi eksik görünüyor."),
  password: z.string().min(1, "Şifreni yazar mısın?"),
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
    throw new AppError("duplicate", "Bu e-postayla zaten bir hesap var. Giriş yapmayı dener misin?");
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
  if (!user || !ok) throw new AppError("credentials", "E-posta ya da şifre eşleşmedi. Bir daha bakar mısın?");
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
