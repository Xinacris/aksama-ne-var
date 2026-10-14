/**
 * Demo-grade password hashing: PBKDF2-SHA-256 with a per-user random salt.
 * This only protects against casual reading of local storage; it is NOT real
 * security (everything lives on the device). The algorithm sits behind a small
 * interface so each platform brings its own primitives: Web Crypto in browsers
 * and Node (the default), expo-crypto + a JS PBKDF2 on phones.
 */
export const PBKDF2_ITERATIONS = 100_000;

export interface PasswordCrypto {
  /** 16 random bytes as hex. */
  randomSalt(): string;
  /** PBKDF2-SHA-256 (256 bits) of `password` with the hex salt, as hex. */
  hashPassword(password: string, saltHex: string): Promise<string>;
}

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Web Crypto (browsers, Node ≥ 20). */
export const webPasswordCrypto: PasswordCrypto = {
  randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
  },
  async hashPassword(password, saltHex) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
      key,
      256,
    );
    return toHex(bits);
  },
};

let impl: PasswordCrypto = webPasswordCrypto;

/** A platform without Web Crypto (React Native) plugs in its own primitives at startup. */
export function setPasswordCrypto(next: PasswordCrypto) {
  impl = next;
}

export function randomSalt(): string {
  return impl.randomSalt();
}

export function hashPassword(password: string, saltHex: string): Promise<string> {
  return impl.hashPassword(password, saltHex);
}

/** Constant-time-ish comparison (length + xor). */
export async function verifyPassword(password: string, saltHex: string, expectedHex: string): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  if (actual.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}
