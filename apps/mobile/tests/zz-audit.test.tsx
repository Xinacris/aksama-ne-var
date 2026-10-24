import { render } from "@testing-library/react-native";
import fs from "node:fs";
import { setLocale } from "@anv/core/i18n";
import { setNow } from "@anv/core/lib/clock";
import { appStore } from "@anv/core/store/app";
import { freshStore, routerMock } from "./helpers";

const screens: [string, string, Record<string, string>][] = [
  ["bugun", "@/app/(tabs)/bugun", {}],
  ["hafta", "@/app/(tabs)/hafta", {}],
  ["eslesme", "@/app/(tabs)/eslesme", {}],
  ["liste", "@/app/(tabs)/liste", {}],
  ["tarifler", "@/app/(tabs)/tarifler", {}],
  ["tarif", "@/app/tarif/[id]", { id: "karniyarik" }],
  ["yeni", "@/app/tarifler/yeni", {}],
  ["iceaktar", "@/app/tarifler/ice-aktar", {}],
  ["duzenle", "@/app/tarifler/[id]/duzenle", { id: "karniyarik" }],
  ["pisir", "@/app/pisir/[id]", { id: "2026-10-12" }],
  ["ayarlar", "@/app/ayarlar", {}],
  ["evde", "@/app/evde/index", {}],
  ["kontrol", "@/app/evde/kontrol", { r: "week:2026-10-12" }],
  ["onb-index", "@/app/onboarding/index", {}],
  ["onb-yemekler", "@/app/onboarding/yemekler", {}],
  ["onb-evde", "@/app/onboarding/evde", {}],
  ["onb-davet", "@/app/onboarding/davet", {}],
  ["giris", "@/app/(auth)/index", {}],
  ["kayit", "@/app/(auth)/kayit", {}],
];
const out: string[] = [];
type Node = { type: unknown; props: Record<string, unknown>; children: (Node | string)[] | null };
function walk(n: Node | string | null, texts: string[], unlabeled: string[]) {
  if (!n) return;
  if (typeof n === "string") return void texts.push(n);
  const p = n.props ?? {};
  for (const k of ["accessibilityLabel", "placeholder", "accessibilityHint"]) if (typeof p[k] === "string") texts.push(`@${k}:${p[k]}`);
  if ((p.accessibilityRole === "button" || p.onPress) && !p.accessibilityLabel) {
    const inner: string[] = [];
    for (const c of n.children ?? []) walk(c, inner, []);
    if (!inner.some((x) => !x.startsWith("@") && x.trim())) unlabeled.push(String(p.testID ?? (typeof n.type === "string" ? n.type : "?")));
  }
  for (const c of n.children ?? []) walk(c, texts, unlabeled);
}
for (const lang of ["tr", "en"] as const) {
  for (const [name, mod, params] of screens) {
    it(`${lang} ${name}`, async () => {
      await freshStore({ demo: true, locale: lang });
      setLocale(lang);
      setNow(new Date(2026, 9, 12, 21, 0));
      routerMock().__params.current = params;
      const Screen = require(mod).default;
      let tree;
      try {
        tree = await render(<Screen />);
      } catch (e) {
        out.push(`${lang}\t${name}\tCRASH\t${String(e).slice(0, 200)}`);
        return;
      }
      const texts: string[] = [];
      const unlabeled: string[] = [];
      walk(tree.toJSON() as never, texts, unlabeled);
      const flat = texts.map((x) => x.trim()).filter(Boolean);
      const keys = flat.filter((x) => /^@?\w*:?[a-z]+[A-Za-z0-9]*(\.[a-zA-Z0-9_]+)+$/.test(x.replace(/^@\w+:/, "")));
      if (keys.length) out.push(`${lang}\t${name}\trawKey\t${keys.join(" | ")}`);
      if (lang === "en") {
        const tr = flat.filter((x) => /[çğışöüÇĞİŞÖÜ]/.test(x));
        if (tr.length) out.push(`${lang}\t${name}\tturkish\t${[...new Set(tr)].slice(0, 30).join(" | ")}`);
      }
      if (unlabeled.length) out.push(`${lang}\t${name}\tunlabeledButton\t${unlabeled.join(",")}`);
      void appStore;
    });
  }
}
afterAll(() => fs.writeFileSync(process.env.AUDIT_OUT ?? "/tmp/mobile-audit.tsv", out.join("\n")));
