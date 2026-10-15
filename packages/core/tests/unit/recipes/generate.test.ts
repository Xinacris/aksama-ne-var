import { describe, expect, it } from "vitest";
import dishList from "../../../data/recipes/dish-list.json";
import { catalogToRecipe } from "@/recipes/load";
import { answerJsonSchema, draftToRecipe, parseAnswer, systemPrompt, userPrompt } from "@/recipes/generate";
import type { Dish } from "@/recipes/schema";

const dishes = dishList as Dish[];
const bourguignon = dishes.find((d) => d.slug === "boeuf-bourguignon")!;

/** A draft as the model writes it (test fixture; real recipes come from the generator). */
const draft = {
  slug: "boeuf-bourguignon",
  title: { tr: "Boeuf bourguignon", en: "Boeuf bourguignon" },
  shortTitle: null,
  description: { tr: "Kırmızı şarapta ağır ateşte pişen, mantarlı ve arpacık soğanlı dana yahni.", en: "Beef slowly braised in red wine with mushrooms and small onions." },
  servings: 4,
  prepMinutes: 25,
  cookMinutes: 150,
  waitMinutes: null,
  difficulty: 2,
  ingredients: [
    { name: { tr: "Dana gulaşlık", en: "Beef stewing meat" }, amount: 800, unit: "g", note: { tr: "iri doğranmış", en: "in large cubes" }, pantryKey: "beef-stew-meat", substitute: null },
    {
      name: { tr: "Kırmızı şarap", en: "Red wine" },
      amount: 400,
      unit: "ml",
      note: null,
      pantryKey: "red-wine",
      substitute: {
        name: { tr: "Et suyu", en: "Beef stock" },
        amount: 400,
        unit: "ml",
        pantryKey: "beef-stock",
        reason: "alcoholFree",
        note: { tr: "Şarap kullanmak istemezseniz: 400 ml et suyu + 2 yemek kaşığı üzüm sirkesi kullanın.", en: "If you prefer not to use wine: use 400 ml beef stock + 2 tbsp grape vinegar." },
      },
    },
    { name: { tr: "Mantar", en: "Mushrooms" }, amount: 250, unit: "g", note: null, pantryKey: "mushroom", substitute: null },
    { name: { tr: "Tuz", en: "Salt" }, amount: null, unit: null, note: null, pantryKey: "salt", substitute: null },
  ],
  steps: [
    { text: { tr: "Eti kızgın tencerede parti parti mühürle.", en: "Brown the beef in batches in a hot pot." }, timerSeconds: null },
    { text: { tr: "Şarabı (ya da yerine kullandığın karışımı) ekleyip 2 dakika kaynat.", en: "Add the wine (or the mix you use instead) and boil for 2 minutes." }, timerSeconds: 120 },
    { text: { tr: "Kapağını kapatıp kısık ateşte 2 saat pişir, mantarı ekleyip 20 dakika daha pişir.", en: "Cover and cook on low heat for 2 hours, add the mushrooms and cook 20 minutes more." }, timerSeconds: 7200 },
  ],
  freezerItem: null,
  tags: ["Tencere", "Etli", "containsAlcohol", "guest"],
  mealSlots: ["dinner"],
  leftover: { likelihood: "medium", keepsDays: 3, reheatable: true },
};

describe("generator", () => {
  it("a valid draft becomes a catalog recipe with the dish list's identity", () => {
    const { recipe, problems } = draftToRecipe(draft, bourguignon);
    expect(problems).toEqual([]);
    expect(recipe).toMatchObject({ id: bourguignon.id, slug: "boeuf-bourguignon", cuisine: "french", category: "main", source: "curated-v1", version: 1 });
  });

  it("alcohol without a substitute, a missing tag, unknown keys and pork are rejected with readable problems", () => {
    const bad = structuredClone(draft) as typeof draft & { ingredients: unknown[] };
    (bad.ingredients[1] as { substitute: unknown }).substitute = null;
    bad.tags = ["Tencere"];
    bad.ingredients.push({ name: { tr: "Domuz pastırması", en: "Bacon" }, amount: 100, unit: "g", note: null, pantryKey: "bacon", substitute: null });
    const { recipe, problems } = draftToRecipe(bad, bourguignon);
    expect(recipe).toBeNull();
    expect(problems.join("\n")).toMatch(/alcohol-free substitute/);
    expect(problems.join("\n")).toMatch(/containsAlcohol/);
    expect(problems.join("\n")).toMatch(/unknown pantryKey "bacon"/);
    expect(problems.join("\n")).toMatch(/pork is not allowed/);
  });

  it("the app shows the substitute under the ingredient and keeps the original", () => {
    const app = catalogToRecipe(draftToRecipe(draft, bourguignon).recipe!);
    const wine = app.ingredients.find((i) => i.name === "Kırmızı şarap")!;
    expect(wine.substitute).toMatchObject({ name: "Et suyu", quantity: 400, unit: "ml", note: expect.stringMatching(/^Şarap kullanmak istemezseniz/) });
    expect(app.translations?.en?.substituteNotes?.["Kırmızı şarap"]).toMatch(/^If you prefer not to use wine/);
    expect(app).toMatchObject({ id: "boeuf-bourguignon", course: "ana", cuisine: "french", category: "main", leftoverPolicy: "none", leftoverLikelihood: "medium" });
  });

  it("answers parse with or without a code fence; prompts carry the rules and the dishes", () => {
    expect(parseAnswer('```json\n{"recipes":[{"slug":"x"}]}\n```')).toEqual([{ slug: "x" }]);
    expect(() => parseAnswer('{"nope":1}')).toThrow(/recipes/);
    expect(systemPrompt()).toMatch(/NO PORK/);
    expect(systemPrompt()).toMatch(/red-wine=Kırmızı şarap \[ALCOHOL\]/);
    expect(userPrompt([bourguignon], new Map([["boeuf-bourguignon", ["tags: missing"]]]))).toMatch(/boeuf-bourguignon: tags: missing/);
    expect(JSON.stringify(answerJsonSchema(false))).toMatch(/pantryKey/);
  });
});
