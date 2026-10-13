import { UNITS } from "@/data/models";
import { IMPORT_ROLES } from "@/domain/import/types";
import type { ProviderInput } from "./types";

/**
 * The one prompt and output schema every LLM provider uses, so a draft looks
 * the same whichever provider answered.
 */

export const SYSTEM_PROMPT = `Sen bir Türk ev mutfağı asistanısın. Kullanıcının yapıştırdığı sosyal medya açıklamasından ya da tarif metninden yapılandırılmış bir tarif taslağı çıkarırsın.
Kurallar:
- Yalnızca metinde olanı yaz; malzeme ya da adım uydurma. Metinde tarif yoksa malzeme ve adım listelerini boş bırak.
- Her şey Türkçe. Yemeğin adı kısa ve cümle düzeninde olsun ("Fırında patatesli köfte"), emoji ve etiket olmasın.
- Birimleri şu listeden seç: ${UNITS.join(", ")}. "yk" yemek kaşığı, "tk" tatlı kaşığı, "çk" çay kaşığı, "sb" su bardağı, "gr" g demektir. Miktarsız malzemelerde amount ve unit null.
- Malzeme adı yalın olsun ("kuru soğan"), "rendelenmiş" gibi ayrıntılar note alanına. Su ekleme.
- side: sebze, meyve, yeşillik "pazar"; et, süt ürünü, bakliyat, baharat, paketli ürün "market".
- Adımları sırayla yaz; adımda süre geçiyorsa minutes alanına dakika olarak yaz ("10-15 dk" → 15).
- role: çorba "corba", ana yemek "ana", pilav/garnitür "yaninda", salata/meze "salata", tatlı ya da belirsizse null.
- prep: önceden yapılması gerekenler ("Kıymayı buzluktan çıkar" → morning, "Nohudu ıslatmaya koy" → night-before, "Marine et" → hour-before).
- Kalori, besin değeri ya da diyet yorumu ekleme.`;

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
export const RECIPE_JSON_SCHEMA: JsonSchema = {
  type: "object",
  required: ["name", "servings", "role", "totalMinutes", "ingredients", "steps", "prep"],
  properties: {
    name: { type: "string" },
    servings: nullable("integer", { minimum: 1, maximum: 20 }),
    role: nullableEnum(IMPORT_ROLES),
    totalMinutes: nullable("integer"),
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
