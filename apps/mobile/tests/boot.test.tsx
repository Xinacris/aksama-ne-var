import AsyncStorage from "@react-native-async-storage/async-storage";
import { bootMobile, resetBootForTests } from "@/boot";
import { useApp } from "@/store";

beforeEach(async () => {
  await AsyncStorage.clear();
  resetBootForTests();
});

describe("boot", () => {
  it("starts anonymous, loads the demo household, and keeps it after a restart", async () => {
    const first = await bootMobile();
    expect(useApp.getState().status).toBe("anon");
    await useApp.getState().loadDemo();
    expect(useApp.getState().status).toBe("ready");
    expect(useApp.getState().people.map((p) => p.name).sort()).toEqual(["Ali", "Zeynep"]);
    await first.flush();
    expect(await AsyncStorage.getItem("anv:t:households")).toContain("Ali");

    // "Restart": hydrate again from AsyncStorage
    resetBootForTests();
    await bootMobile();
    expect(useApp.getState().status).toBe("ready");
    expect(useApp.getState().recipes.length).toBeGreaterThan(90);
  }, 30000);
});
