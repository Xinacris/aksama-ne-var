import { importRouteFor, isSharePath } from "@/share/incoming";

jest.mock("expo-sharing", () => {
  const state = { payloads: [] as { shareType?: string; value?: string; mimeType?: string }[] };
  return { __state: state, getSharedPayloads: jest.fn(() => state.payloads), clearSharedPayloads: jest.fn(() => void (state.payloads = [])) };
});
const sharing = () => jest.requireMock("expo-sharing") as { __state: { payloads: { shareType?: string; value?: string }[] }; clearSharedPayloads: jest.Mock };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { shareOptions } = require("../plugins/withShareIntake") as { shareOptions: (env?: Record<string, string | undefined>) => { android: { enabled: boolean; singleShareMimeTypes: string[] }; ios: { enabled: boolean } } };

describe("share sheet → import screen", () => {
  it("a shared reel link (Instagram shares text) opens the import prefilled", () => {
    expect(importRouteFor([{ shareType: "text", value: "https://www.instagram.com/reel/C7xYz12AbCd/?igsh=abc" }])).toBe(
      `/tarifler/ice-aktar?text=${encodeURIComponent("https://www.instagram.com/reel/C7xYz12AbCd/?igsh=abc")}`,
    );
    // TikTok sends a sentence with the link; YouTube a url payload
    expect(importRouteFor([{ shareType: "text", value: "Şu tarife bak! https://vm.tiktok.com/ZMabc/" }])).toContain(encodeURIComponent("https://vm.tiktok.com/ZMabc/"));
    expect(importRouteFor([{ shareType: "url", value: "https://youtube.com/shorts/aBcDeFgHiJk" }])).toContain(encodeURIComponent("https://youtube.com/shorts/aBcDeFgHiJk"));
    // an image (nothing to read) opens the empty import screen
    expect(importRouteFor([{ shareType: "image", value: "file:///x.jpg" }])).toBe("/tarifler/ice-aktar");
    expect(importRouteFor([])).toBe("/tarifler/ice-aktar");
  });

  it("only expo-sharing's link is a share", () => {
    expect(isSharePath("mealplanner://expo-sharing")).toBe(true);
    expect(isSharePath("mealplanner://pisir/2026-10-12")).toBe(false);
    expect(isSharePath("/tarifler")).toBe(false);
  });

  it("the router redirect consumes the share once", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { redirectSystemPath } = require("@/app/+native-intent") as typeof import("@/app/+native-intent");
    sharing().__state.payloads = [{ shareType: "text", value: "https://www.instagram.com/reel/C7x/" }];
    expect(await redirectSystemPath({ path: "mealplanner://expo-sharing", initial: true })).toBe(`/tarifler/ice-aktar?text=${encodeURIComponent("https://www.instagram.com/reel/C7x/")}`);
    expect(sharing().clearSharedPayloads).toHaveBeenCalled();
    expect(await redirectSystemPath({ path: "/pisir/kuru-fasulye", initial: false })).toBe("/pisir/kuru-fasulye");
  });

  it("Android always takes text shares; the iOS extension only with ANV_IOS_SHARE_EXTENSION=1", () => {
    expect(shareOptions({}).android).toMatchObject({ enabled: true, singleShareMimeTypes: ["text/plain"] });
    expect(shareOptions({}).ios.enabled).toBe(false);
    expect(shareOptions({ ANV_IOS_SHARE_EXTENSION: "1" }).ios.enabled).toBe(true);
  });
});
