import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import * as ExpoCrypto from "expo-crypto";
import { toHex, fromHex, type PasswordCrypto } from "@anv/core/lib/crypto";

/**
 * React Native has no Web Crypto `subtle`, and expo-crypto offers digests and
 * random bytes but no PBKDF2. Salt: expo-crypto (native CSPRNG). Key
 * derivation: @noble/hashes (audited, pure JS, works in Expo Go). Without a JIT
 * 100 000 rounds take seconds, so phones use 10 000; the count is stored in
 * the hash (`pbkdf2$10000$…`). Demo-grade local accounts, as on the web.
 */
export const MOBILE_PBKDF2_ITERATIONS = 10_000;

export const mobilePasswordCrypto: PasswordCrypto = {
  iterations: MOBILE_PBKDF2_ITERATIONS,
  randomSalt: () => toHex(ExpoCrypto.getRandomBytes(16)),
  async pbkdf2(password, saltHex, iterations) {
    const key = await pbkdf2Async(sha256, password, fromHex(saltHex), { c: iterations, dkLen: 32 });
    return toHex(key);
  },
};
