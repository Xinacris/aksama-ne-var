/**
 * Demo-grade password hashing with Web Crypto PBKDF2-SHA-256 and a per-user
 * random salt. This only protects against casual reading of localStorage;
 * it is NOT real security (everything lives in the browser).
 */
const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

/** Constant-time-ish comparison (length + xor). */
export async function verifyPassword(password: string, saltHex: string, expectedHex: string): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  if (actual.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}
