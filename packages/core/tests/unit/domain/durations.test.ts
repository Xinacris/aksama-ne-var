import { describe, expect, it } from "vitest";
import { findDurations, formatCountdown, formatTimerLength, parseDurationMinutes, wordNumber } from "@/domain/durations";

describe("durations", () => {
  const cases: [string, number | null][] = [
    ["Kısık ateşte 20 dakika pişir.", 20],
    ["20 dk demlendir", 20],
    ["20dk. kaynat", 20],
    ["Yarım saat fırında kalsın.", 30],
    ["çeyrek saat dinlendir", 15],
    ["10-15 dk pişirin", 15],
    ["10–15 dakika", 15],
    ["10 ila 15 dakika kadar", 15],
    ["5 ya da 6 dakika", 6],
    ["1 saat haşla", 60],
    ["1,5 saat kaynat", 90],
    ["1.5 saat", 90],
    ["bir buçuk saat pişir", 90],
    ["2 buçuk saat", 150],
    ["1 saat 15 dakika fırınla", 75],
    ["1 sa 15 dk", 75],
    ["yaklaşık bir saat", 60],
    ["On beş dakika dinlendir", 15],
    ["Yirmi dakikalık bir dinlenme", 20],
    ["Kırk beş dakika pişirin", 45],
    ["45 saniye çevir", 1],
    ["30 sn karıştır", 1],
    ["Fırını 180 dereceye ısıt", null],
    ["Bir gece ıslat", null],
    ["Birkaç dakika kavur", null],
    ["Soğanı ekle ve karıştır", null],
    ["sonra 5 dakika", 5],
  ];
  it.each(cases)("%s → %s", (text, minutes) => {
    expect(parseDurationMinutes(text)).toBe(minutes);
  });

  it("finds every duration in a step, with seconds", () => {
    const d = findDurations("Fasulyeyi 10 dakika haşla, süz; sonra kısık ateşte 1 saat pişir.");
    expect(d.map((x) => x.seconds)).toEqual([600, 3600]);
    expect(d[0].text).toBe("10 dakika");
    expect(findDurations("45 saniye çevir")[0].seconds).toBe(45);
  });

  it("ignores durations longer than 12 hours", () => {
    expect(findDurations("24 saat marine et")).toEqual([]);
  });

  it("reads number words", () => {
    expect(wordNumber("kırk beş")).toBe(45);
    expect(wordNumber("yarım")).toBe(0.5);
    expect(wordNumber("12")).toBe(12);
    expect(wordNumber("elma")).toBeNull();
  });

  it("formats countdowns and timer lengths", () => {
    expect(formatCountdown(605)).toBe("10:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
    expect(formatCountdown(-3)).toBe("0:00");
    expect(formatCountdown(0.2)).toBe("0:01");
    expect(formatTimerLength(1200)).toBe("20 dk");
    expect(formatTimerLength(4500)).toBe("1 sa 15 dk");
    expect(formatTimerLength(3600)).toBe("1 sa");
    expect(formatTimerLength(45)).toBe("45 sn");
  });
});
