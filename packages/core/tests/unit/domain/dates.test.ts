import { describe, expect, it } from "vitest";
import {
  addDays,
  agoDays,
  agoTime,
  boardWindow,
  dayName,
  dayShort,
  formatDuration,
  longDate,
  rangeLabel,
  shortDayMonth,
  toIsoDate,
} from "@/domain/dates";

describe("dates", () => {
  it("formats the design's header date", () => {
    expect(longDate("2026-10-12")).toBe("Pazartesi, 12 Ekim");
    expect(dayName("2026-10-15")).toBe("Perşembe");
    expect(dayShort("2026-10-10")).toBe("Cmt");
    expect(dayShort("2026-10-14")).toBe("Çar");
    expect(shortDayMonth("2026-10-10")).toBe("10 Eki");
  });

  it("builds the board window: two days back, five ahead", () => {
    const w = boardWindow("2026-10-12");
    expect(w[0]).toBe("2026-10-10");
    expect(w[6]).toBe("2026-10-16");
    expect(rangeLabel(w[0], w[6])).toBe("10 – 16 Ekim");
    expect(rangeLabel("2026-09-28", "2026-10-04")).toBe("28 Eylül – 4 Ekim");
  });

  it("does date math in local time across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(toIsoDate(new Date(2026, 9, 12, 23, 59))).toBe("2026-10-12");
  });

  it("formats durations like the design", () => {
    expect(formatDuration(30)).toBe("30 dk");
    expect(formatDuration(70)).toBe("1 sa 10 dk");
    expect(formatDuration(75)).toBe("1 sa 15 dk");
    expect(formatDuration(120)).toBe("2 sa");
  });

  it("phrases rotation distances", () => {
    expect(agoDays(1)).toBe("dün");
    expect(agoDays(10)).toBe("10 gün önce");
    expect(agoDays(21)).toBe("3 hafta önce");
    expect(agoDays(35)).toBe("5 hafta önce");
    expect(agoDays(60)).toBe("2 ay önce");
  });

  it("phrases activity times", () => {
    const now = new Date(2026, 9, 12, 15, 0);
    expect(agoTime(new Date(2026, 9, 12, 14, 59, 30).toISOString(), now)).toBe("az önce");
    expect(agoTime(new Date(2026, 9, 12, 14, 46).toISOString(), now)).toBe("14 dk önce");
    expect(agoTime(new Date(2026, 9, 12, 11, 0).toISOString(), now)).toBe("4 sa önce");
    expect(agoTime(new Date(2026, 9, 11, 22, 0).toISOString(), now)).toBe("dün");
  });
});
