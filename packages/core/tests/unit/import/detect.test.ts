import { describe, expect, it } from "vitest";
import { detectPlatform, extractUrl, normalizeUrl, youtubeId } from "@/domain/import/detect";

describe("detectPlatform", () => {
  it.each([
    ["https://www.instagram.com/reel/C7xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==", "instagram"],
    ["instagram.com/p/C7xYz12AbCd/", "instagram"],
    ["https://instagram.com/mutfakdefteri/reel/C7xYz12AbCd/", "instagram"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "youtube"],
    ["https://youtube.com/shorts/aBcDeFgHiJk?si=xyz", "youtube"],
    ["https://youtu.be/aBcDeFgHiJk?si=share", "youtube"],
    ["https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567?is_from_webapp=1&sender_device=pc", "tiktok"],
    ["https://vm.tiktok.com/ZMabc123/", "tiktok"],
    ["https://www.ornek-tarifler.com/tarif/izmir-kofte", "web"],
    ["ornek-tarifler.com/kofte", "web"],
  ])("%s → %s", (url, platform) => expect(detectPlatform(url)).toBe(platform));

  it("rejects things that are not web links", () => {
    expect(detectPlatform("")).toBeNull();
    expect(detectPlatform("mercimek çorbası")).toBeNull();
    expect(detectPlatform("javascript:alert(1)")).toBeNull();
    expect(detectPlatform("ftp://example.com/x")).toBeNull();
    expect(detectPlatform("http://localhost/x")).toBeNull();
  });
});

describe("normalizeUrl", () => {
  it.each([
    ["https://www.instagram.com/reel/C7xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==", "https://www.instagram.com/reel/C7xYz12AbCd/"],
    ["instagram.com/reels/C7xYz12AbCd", "https://www.instagram.com/reel/C7xYz12AbCd/"],
    ["https://www.instagram.com/p/C7xYz12AbCd/?utm_source=ig_web_copy_link", "https://www.instagram.com/p/C7xYz12AbCd/"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&feature=share", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://youtu.be/aBcDeFgHiJk?si=share", "https://www.youtube.com/watch?v=aBcDeFgHiJk"],
    ["https://youtube.com/shorts/aBcDeFgHiJk?si=xyz", "https://www.youtube.com/shorts/aBcDeFgHiJk"],
    ["https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567?is_from_webapp=1&sender_device=pc#x", "https://www.tiktok.com/@mutfakdefteri/video/7312345678901234567"],
    ["https://vm.tiktok.com/ZMabc123", "https://vm.tiktok.com/ZMabc123/"],
    ["http://Ornek-Tarifler.com/tarif?id=5&utm_source=x&fbclid=abc#yorumlar", "https://ornek-tarifler.com/tarif?id=5"],
    ["https://ornek-tarifler.com/tarif?utm_medium=social", "https://ornek-tarifler.com/tarif"],
  ])("%s", (raw, out) => expect(normalizeUrl(raw)).toBe(out));

  it("returns null for non-links", () => expect(normalizeUrl("bugün ne pişirsek")).toBeNull());
});

describe("helpers", () => {
  it("pulls the link out of shared text", () => {
    expect(extractUrl("Bu tarife bak 😋 https://vm.tiktok.com/ZMabc123/ çok güzel")).toBe("https://vm.tiktok.com/ZMabc123/");
    expect(extractUrl("(https://youtu.be/aBcDeFgHiJk).")).toBe("https://youtu.be/aBcDeFgHiJk");
    expect(extractUrl("şuna bak instagram.com/reel/C7xYz12AbCd/")).toBe("https://instagram.com/reel/C7xYz12AbCd/");
    expect(extractUrl("link yok")).toBeNull();
  });

  it("finds YouTube ids", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/feed/trending")).toBeNull();
  });
});
