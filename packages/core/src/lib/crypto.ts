/**
 * Demo-grade password hashing: PBKDF2-SHA-256 with a per-user random salt.
 * This only protects against casual reading of local storage; it is NOT real
 * security (everything lives on the device). The algorithm sits behind a small
 * interface so each platform brings its own primitives: Web Crypto in browsers
 * and Node (the default), expo-crypto + a JS PBKDF2 on phones.
 */
export const PBKDF2_ITERATIONS = 100_000;

export interface PasswordCrypto {
  /** Iterations this platform uses for new hashes (web: 100 000). */
  readonly iterations: number;
  /** 16 random bytes as hex. */
  randomSalt(): string;
  /** PBKDF2-SHA-256 (256 bits) of `password` with the hex salt, as hex. */
  pbkdf2(password: string, saltHex: string, iterations: number): Promise<string>;
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
  iterations: PBKDF2_ITERATIONS,
  randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
  },
  async pbkdf2(password, saltHex, iterations) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations },
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

/**
 * Stored form: plain hex for the default 100 000 iterations (every hash made so
 * far), `pbkdf2$<iterations>$<hex>` otherwise. A phone without a JIT needs
 * seconds for 100 000 rounds of JS PBKDF2, so it uses fewer and says so.
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const hex = await impl.pbkdf2(password, saltHex, impl.iterations);
  return impl.iterations === PBKDF2_ITERATIONS ? hex : `pbkdf2$${impl.iterations}$${hex}`;
}

function parseStored(stored: string): { iterations: number; hex: string } {
  const m = /^pbkdf2\$(\d+)\$([0-9a-f]+)$/.exec(stored);
  return m ? { iterations: Number(m[1]), hex: m[2] } : { iterations: PBKDF2_ITERATIONS, hex: stored };
}

/** Constant-time-ish comparison (length + xor), with the iteration count the hash was made with. */
export async function verifyPassword(password: string, saltHex: string, stored: string): Promise<boolean> {
  const { iterations, hex: expectedHex } = parseStored(stored);
  const actual = await impl.pbkdf2(password, saltHex, iterations);
  if (actual.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}
