import type { ImportLog } from "@/data/models";
import { toIsoDate } from "../dates";

const PROVIDER_LABEL: Record<ImportLog["provider"], string> = { gemini: "Gemini", claude: "Claude", rules: "kural" };

/** "Bu ay 12 tarif içe aktarıldı (11 Gemini, 1 kural)" — drafts produced in `month` (YYYY-MM), by provider. */
export function importUsageText(log: ImportLog[], month: string): string {
  const thisMonth = log.filter((l) => toIsoDate(new Date(l.createdAt)).slice(0, 7) === month);
  if (thisMonth.length === 0) return "Bu ay henüz linkten tarif içe aktarılmadı.";
  const split = (Object.keys(PROVIDER_LABEL) as ImportLog["provider"][])
    .map((p) => [thisMonth.filter((l) => l.provider === p).length, PROVIDER_LABEL[p]] as const)
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`);
  return `Bu ay ${thisMonth.length} tarif içe aktarıldı (${split.join(", ")}).`;
}
