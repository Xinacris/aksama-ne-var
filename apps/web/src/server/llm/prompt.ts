import { UNITS } from "@anv/core/data/models";
import { COOKING_METHOD_TAGS, MAIN_INGREDIENT_TAGS, PREP_TAGS } from "@anv/core/domain/import/tags";
import { IMPORT_ROLES } from "@anv/core/domain/import/types";
import type { LlmTask, ProviderInput } from "./types";

/**
 * The one prompt and output schema every LLM provider uses, so a draft looks
 * the same whichever provider answered.
 */

const LANGUAGE_RULE: Record<"tr" | "en", string> = {
  tr: `- Metin hangi dilde olursa olsun anla; taslağın metinlerini (ad, malzeme adları, notlar, adımlar, ön hazırlık) Türkçe yaz. Yemeğin adı kısa ve cümle düzeninde olsun ("Fırında patatesli köfte"), emoji ve etiket olmasın.`,
  en: `- Metin hangi dilde olursa olsun anla; taslağın metinlerini (ad, malzeme adları, notlar, adımlar, ön hazırlık) İngilizce yaz. Yemeğin adı kısa ve cümle düzeninde olsun ("Baked meatballs with potatoes"); bilinen Türk yemeklerinin adını Türkçe bırakıp parantezde kısa İngilizce açıklama ekleyebilirsin ("Karnıyarık (stuffed aubergine)"). Emoji ve etiket olmasın.`,
};

/** The import instructions; only the language rule differs between Turkish and English drafts. */
/**
 * Screenshot text (phone OCR) can come back without Turkish letters. Added only for such text, so
 * every other request is unchanged.
 */
export const OCR_RULE =
  "- Bu metin telefonda ekran görüntüsünden okundu; Türkçe harfler kaybolmuş olabilir (ş→s, ı→i, ğ→g, ç→c, ö→o, ü→u). Tarif adında, malzemelerde ve adımlarda doğru Türkçe yazımı geri getir (\"sogan\" → \"soğan\", \"yemek kasigi\" → \"yemek kaşığı\"). Yalnızca harfleri düzelt: kelime ekleme ya da çıkarma, sayıları, miktarları ve birimleri değiştirme. Bir kelimenin doğru hâlinden emin değilsen olduğu gibi bırak.";

export function systemPrompt(locale: "tr" | "en" = "tr", opts: { ocr?: boolean } = {}): string {
  return `Sen bir ev mutfağı asistanısın. Kullanıcının yapıştırdığı sosyal medya açıklamasından ya da tarif metninden yapılandırılmış bir tarif taslağı çıkarırsın.
Kurallar:
- Yalnızca metinde olanı yaz; malzeme ya da adım uydurma. Metinde tarif yoksa malzeme ve adım listelerini boş bırak.
${LANGUAGE_RULE[locale]}
- sourceLang: metnin yazıldığı dilin ISO 639-1 kodu ("tr", "en", "it"…).
- Birimleri şu listeden seç: ${UNITS.join(", ")}. "yk" yemek kaşığı, "tk" tatlı kaşığı, "çk" çay kaşığı, "sb" su bardağı, "gr" g demektir. Miktarsız malzemelerde amount ve unit null.
- Malzeme adı yalın olsun ("kuru soğan"), "rendelenmiş" gibi ayrıntılar note alanına. Su ekleme.
- side: sebze, meyve, yeşillik "pazar"; et, süt ürünü, bakliyat, baharat, paketli ürün "market".
- Adımlar yalnızca pişirme/hazırlama eylemleridir. Linkleri, abone ol/takip et çağrılarını, sosyal medya hesaplarını, sponsor ve ürün tanıtımlarını, kanal ya da şef tanıtımlarını ASLA adım olarak yazma. Metinde adım yoksa steps boş liste olsun; adım uydurma.
- Adımları sırayla yaz; adımda süre geçiyorsa minutes alanına dakika olarak yaz ("10-15 dk" → 15).
- Süreler: cookMinutes yalnızca ocakta, fırında ya da yağda geçen süredir. prepMinutes doğrama, karıştırma gibi elle yapılan hazırlıktır. Marine etme, dinlendirme, ıslatma, buzdolabında bekletme, soğutma ve mayalanma pişirme DEĞİLDİR: bunları waitMinutes'a yaz; bir geceden uzunsa waitMinutes'a yazma, prep listesine ekle. Metinde süre yoksa ilgili alanı null bırak; tahmin etme. totalMinutes yalnızca metinde toplam süre yazıyorsa doldurulur.
- Etiketler: cookingMethods (${COOKING_METHOD_TAGS.join(", ")}), mainIngredients (${MAIN_INGREDIENT_TAGS.join(", ")}; Vejetaryen = et, tavuk ve balık yok), prepTags (${PREP_TAGS.join(", ")}). Yalnızca bu listelerdeki değerleri, yalnızca metin açıkça destekliyorsa kullan; emin değilsen boş bırak.
- role: çorba "corba", ana yemek "ana", pilav/garnitür "yaninda", salata/meze "salata", tatlı ya da belirsizse null.
- prep: önceden yapılması gerekenler ("Kıymayı buzluktan çıkar" → morning, "Nohudu ıslatmaya koy" → night-before, "Marine et" → hour-before).
- Kalori, besin değeri ya da diyet yorumu ekleme.${opts.ocr ? `\n${OCR_RULE}` : ""}`;
}

/** The Turkish import prompt (the default). */
export const SYSTEM_PROMPT = systemPrompt("tr");

/** Added to the user message on the single retry after invalid output. */
export const RETRY_NOTE = "Önceki yanıt şemaya uymadı. Lütfen yalnızca şemaya uyan geçerli bir tarif taslağı döndür.";

/** User message: the caption and its platform — nothing else ever leaves the server. */
export function userPrompt(input: ProviderInput, retry: boolean): string {
  const head = input.platform ? `Kaynak: ${input.platform}\n\n` : "";
  return `${head}Metin:\n"""\n${input.text}\n"""${retry ? `\n\n${RETRY_NOTE}` : ""}`;
}

type JsonSchema = { [k: string]: unknown };

const nullable = (type: string, extra: JsonSchema = {}): JsonSchema => ({ type: [type, "null"], ...extra });
const nullableEnum = (values: readonly string[]): JsonSchema => ({ type: ["string", "null"], enum: [...values, null] });

/** JSON Schema of `ImportedRecipe` (the zod schema in `src/domain/import/types.ts` is the validator). */
const tagList = (values: readonly string[]): JsonSchema => ({ type: "array", items: { type: "string", enum: [...values] } });

export const RECIPE_JSON_SCHEMA: JsonSchema = {
  type: "object",
  required: [
    "name",
    "servings",
    "role",
    "totalMinutes",
    "prepMinutes",
    "cookMinutes",
    "waitMinutes",
    "ingredients",
    "steps",
    "prep",
    "cookingMethods",
    "mainIngredients",
    "prepTags",
    "sourceLang",
  ],
  properties: {
    name: { type: "string" },
    sourceLang: nullable("string"),
    servings: nullable("integer", { minimum: 1, maximum: 20 }),
    role: nullableEnum(IMPORT_ROLES),
    totalMinutes: nullable("integer"),
    prepMinutes: nullable("integer"),
    cookMinutes: nullable("integer"),
    waitMinutes: nullable("integer"),
    cookingMethods: tagList(COOKING_METHOD_TAGS),
    mainIngredients: tagList(MAIN_INGREDIENT_TAGS),
    prepTags: tagList(PREP_TAGS),
    ingredients: {
      type: "array",
      items: {
        type: "object",
        required: ["amount", "unit", "item", "side"],
        properties: {
          amount: nullable("number"),
          unit: nullableEnum(UNITS),
          item: { type: "string" },
          side: nullableEnum(["pazar", "market"]),
          note: nullable("string"),
        },
      },
    },
    steps: {
      type: "array",
      items: { type: "object", required: ["text", "minutes"], properties: { text: { type: "string" }, minutes: nullable("number") } },
    },
    prep: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "when"],
        properties: { label: { type: "string" }, when: { type: "string", enum: ["night-before", "morning", "hour-before"] } },
      },
    },
  },
};

/** The import as a provider task (shared by Gemini and Claude). */
export function recipeTask(input: ProviderInput, retry: boolean): LlmTask {
  return {
    system: systemPrompt(input.locale ?? "tr", { ocr: input.ocr }),
    user: userPrompt(input, retry),
    schema: RECIPE_JSON_SCHEMA,
    tool: { name: "tarif_taslagi", description: "Metinden çıkarılan tarif taslağını kaydeder." },
  };
}
