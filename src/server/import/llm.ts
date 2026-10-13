import type Anthropic from "@anthropic-ai/sdk";
import { UNITS } from "@/data/models";
import { findDurations } from "@/domain/durations";
import type { Structurer } from "@/domain/import/pipeline";
import { IMPORT_ROLES, importedRecipeSchema, type ImportedRecipe } from "@/domain/import/types";
import { normalizeUnit } from "@/domain/import/units";

export const IMPORT_MODEL = "claude-haiku-5-5";
export const IMPORT_MAX_TOKENS = 1500;

/** The only part of the SDK we use; tests pass a fake. */
export type MessagesClient = Pick<Anthropic, "messages">;

const SYSTEM = `Sen bir Türk ev mutfağı asistanısın. Kullanıcının yapıştırdığı sosyal medya açıklamasından ya da tarif metninden yapılandırılmış bir tarif taslağı çıkarırsın.
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

const TOOL: Anthropic.Tool = {
  name: "tarif_taslagi",
  description: "Metinden çıkarılan tarif taslağını kaydeder.",
  input_schema: {
    type: "object",
    required: ["name", "servings", "role", "totalMinutes", "ingredients", "steps", "prep"],
    properties: {
      name: { type: "string" },
      servings: { type: ["integer", "null"], minimum: 1, maximum: 20 },
      role: { type: ["string", "null"], enum: [...IMPORT_ROLES, null] },
      totalMinutes: { type: ["integer", "null"] },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          required: ["amount", "unit", "item", "side"],
          properties: {
            amount: { type: ["number", "null"] },
            unit: { type: ["string", "null"], enum: [...UNITS, null] },
            item: { type: "string" },
            side: { type: ["string", "null"], enum: ["pazar", "market", null] },
            note: { type: ["string", "null"] },
          },
        },
      },
      steps: {
        type: "array",
        items: { type: "object", required: ["text", "minutes"], properties: { text: { type: "string" }, minutes: { type: ["number", "null"] } } },
      },
      prep: {
        type: "array",
        items: { type: "object", required: ["label", "when"], properties: { label: { type: "string" }, when: { type: "string", enum: ["night-before", "morning", "hour-before"] } } },
      },
    },
  },
};

/** Light cleanup before validation: spoken units, zero amounts, stray fields. */
function tidy(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const r = input as Record<string, unknown>;
  const ingredients = Array.isArray(r.ingredients)
    ? (r.ingredients as Record<string, unknown>[]).map((i) => {
        const unit = typeof i.unit === "string" ? ((UNITS as readonly string[]).includes(i.unit) ? i.unit : normalizeUnit(i.unit)) : null;
        const amount = typeof i.amount === "number" && i.amount > 0 ? i.amount : null;
        return { amount, unit: amount === null ? null : unit, item: i.item, side: i.side ?? null, note: typeof i.note === "string" && i.note.trim() ? i.note : null };
      })
    : r.ingredients;
  const steps = Array.isArray(r.steps)
    ? (r.steps as Record<string, unknown>[]).map((s) => ({ text: s.text, minutes: typeof s.minutes === "number" && s.minutes > 0 ? s.minutes : null }))
    : r.steps;
  return { ...r, ingredients, steps, prep: r.prep ?? [] };
}

/** Steps whose text lacks the duration the model found get "(20 dk)", so cooking-mode timers see it. */
function withDurations(r: ImportedRecipe): ImportedRecipe {
  return {
    ...r,
    steps: r.steps.map((s) => (s.minutes && !findDurations(s.text).length ? { ...s, text: `${s.text.replace(/\s+$/, "")} (${Math.round(s.minutes)} dk)` } : s)),
  };
}

export function parseToolOutput(message: Anthropic.Message): ImportedRecipe | null {
  const block = message.content.find((b) => b.type === "tool_use" && b.name === TOOL.name);
  if (!block || block.type !== "tool_use") return null;
  const parsed = importedRecipeSchema.safeParse(tidy(block.input));
  return parsed.success ? withDurations(parsed.data) : null;
}

/**
 * Claude Haiku structurer: forced tool use, zod validation, one retry on
 * invalid output, then null (the pipeline falls back to the rule parser).
 * Never logs the caption.
 */
export function llmStructurer(client: MessagesClient, opts: { signal?: AbortSignal; timeoutMs?: number } = {}): Structurer {
  return async (text, hint) => {
    const intro = [hint.platform ? `Kaynak: ${hint.platform}` : null, hint.title ? `Başlık: ${hint.title}` : null].filter(Boolean).join("\n");
    const user = `${intro ? `${intro}\n\n` : ""}Metin:\n"""\n${text}\n"""`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const msg = await client.messages.create(
          {
            model: IMPORT_MODEL,
            max_tokens: IMPORT_MAX_TOKENS,
            system: SYSTEM,
            tools: [TOOL],
            tool_choice: { type: "tool", name: TOOL.name, disable_parallel_tool_use: true },
            messages: [
              {
                role: "user",
                content: attempt === 0 ? user : `${user}\n\nÖnceki yanıt şemaya uymadı. Lütfen yalnızca tarif_taslagi aracını geçerli alanlarla çağır.`,
              },
            ],
          },
          { signal: opts.signal, timeout: opts.timeoutMs ?? 15_000, maxRetries: 0 },
        );
        const out = parseToolOutput(msg);
        if (out) return out;
      } catch (e) {
        if (opts.signal?.aborted) return null;
        console.warn("[import] llm call failed:", e instanceof Error ? e.name : "unknown");
        return null;
      }
    }
    console.warn("[import] llm output invalid twice; using rules");
    return null;
  };
}
