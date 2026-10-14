import AsyncStorage from "@react-native-async-storage/async-storage";
import { webPasswordCrypto } from "@anv/core/lib/crypto";
import { hydrateAsyncStore } from "@/asyncStore";
import { mobilePasswordCrypto } from "@/crypto";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("AsyncStorage key-value store", () => {
  it("hydrates our keys into memory and ignores others", async () => {
    await AsyncStorage.multiSet([
      ["anv:t:recipes", "[]"],
      ["anv.theme", "dark"],
      ["someone-else", "x"],
    ]);
    const { store } = await hydrateAsyncStore();
    expect(store.getItem("anv:t:recipes")).toBe("[]");
    expect(store.getItem("anv.theme")).toBe("dark");
    expect(store.getItem("someone-else")).toBeNull();
    expect(store.keys().sort()).toEqual(["anv.theme", "anv:t:recipes"]);
  });

  it("writes through in order and survives a restart", async () => {
    const a = await hydrateAsyncStore();
    a.store.setItem("anv:x", "1");
    a.store.setItem("anv:x", "2");
    a.store.setItem("anv:y", "3");
    a.store.removeItem("anv:y");
    // Synchronous reads see the write at once
    expect(a.store.getItem("anv:x")).toBe("2");
    await a.flush();
    expect(await AsyncStorage.getItem("anv:x")).toBe("2");
    expect(await AsyncStorage.getItem("anv:y")).toBeNull();
    const b = await hydrateAsyncStore();
    expect(b.store.getItem("anv:x")).toBe("2");
  });
});

describe("mobile password crypto", () => {
  it("computes the same PBKDF2 as Web Crypto for the same iterations", async () => {
    const salt = mobilePasswordCrypto.randomSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(await mobilePasswordCrypto.pbkdf2("kofte123", salt, 1000)).toBe(await webPasswordCrypto.pbkdf2("kofte123", salt, 1000));
  });
});
