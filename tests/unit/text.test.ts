import { describe, expect, it } from "vitest";
import { ablativeSuffix, dative, genitive, numberAccusative, slugify } from "@/lib/text";

describe("Turkish text helpers", () => {
  it("slugifies Turkish names", () => {
    expect(slugify("İzmir köfte")).toBe("izmir-kofte");
    expect(slugify("Şehriyeli pilav")).toBe("sehriyeli-pilav");
    expect(slugify("Çılbır")).toBe("cilbir");
  });
  it("applies genitive and dative suffixes", () => {
    expect(genitive("Ali")).toBe("Ali'nin");
    expect(genitive("Zeynep")).toBe("Zeynep'in");
    expect(genitive("Can")).toBe("Can'ın");
    expect(genitive("Ufuk")).toBe("Ufuk'un");
    expect(genitive("Ayşe")).toBe("Ayşe'nin");
    expect(dative("Perşembe")).toBe("Perşembe'ye");
    expect(dative("Salı")).toBe("Salı'ya");
    expect(dative("Cumartesi")).toBe("Cumartesi'ye");
    expect(dative("Pazar")).toBe("Pazar'a");
    expect(ablativeSuffix("Cumartesi")).toBe("den");
    expect(ablativeSuffix("Pazartesi")).toBe("den");
    expect(ablativeSuffix("Salı")).toBe("dan");
    expect(ablativeSuffix("Pazar")).toBe("dan");
  });

  it("reads numbers with the accusative possessive", () => {
    expect(["8", "3", "6", "2", "1", "4", "5", "7", "9", "10", "12", "20", "0"].map((n) => numberAccusative(Number(n)))).toEqual([
      "8'ini",
      "3'ünü",
      "6'sını",
      "2'sini",
      "1'ini",
      "4'ünü",
      "5'ini",
      "7'sini",
      "9'unu",
      "10'unu",
      "12'sini",
      "20'sini",
      "0'ını",
    ]);
  });
});
