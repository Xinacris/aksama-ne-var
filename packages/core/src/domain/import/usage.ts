import { labelRecord, t } from "../../i18n";
import type { ImportLog } from "../../data/models";
import { toIsoDate } from "../dates";

const PROVIDER_LABEL = labelRecord<ImportLog["provider"]>("import.provider", ["gemini", "claude", "web", "rules"]);

/** "Bu ay 12 tarif içe aktarıldı (11 Gemini, 1 kural)" — drafts produced in `month` (YYYY-MM), by provider. */
export function importUsageText(log: ImportLog[], month: string): string {
  const thisMonth = log.filter((l) => toIsoDate(new Date(l.createdAt)).slice(0, 7) === month);
  if (thisMonth.length === 0) return t("import.usage.none");
  const split = (Object.keys(PROVIDER_LABEL) as ImportLog["provider"][])
    .map((p) => [thisMonth.filter((l) => l.provider === p).length, PROVIDER_LABEL[p]] as const)
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`);
  return t("import.usage.some", { count: thisMonth.length, split: split.join(", ") });
}
