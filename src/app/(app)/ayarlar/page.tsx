"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconLink, IconMessage } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { DishChip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/Field";
import { useInviteLink } from "@/hooks/useInviteLink";
import { usePeople } from "@/hooks/usePeople";
import { useTheme } from "@/hooks/useTheme";
import { initialOf } from "@/services/auth";
import { whatsappShareUrl } from "@/services/household";
import { useApp } from "@/store/app";
import type { Household, ImportLog } from "@/data/models";
import { toIsoDate } from "@/domain/dates";
import { importUsageText } from "@/domain/import/usage";
import { now } from "@/lib/clock";
import type { ThemePreference } from "@/lib/theme";
import s from "./page.module.css";

const THEMES: [ThemePreference, string][] = [
  ["light", "Açık"],
  ["dark", "Koyu"],
  ["system", "Sistem"],
];

const LUNCH: [Household["lunchAtHome"], string][] = [
  ["yes", "Evet"],
  ["no", "Hayır"],
  ["some", "Bazı günler"],
];
// Monday first, as Turkish calendars are.
const WEEKDAYS: [number, string][] = [
  [1, "Pzt"],
  [2, "Sal"],
  [3, "Çar"],
  [4, "Per"],
  [5, "Cum"],
  [6, "Cmt"],
  [0, "Paz"],
];
const WEEKDAY_LONG = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** "Öğlenleri evde yiyen var mı?" — decides whether leftovers become a lunch or go in the fridge. */
function LunchSetting() {
  const household = useApp((x) => x.household);
  const setLunchAtHome = useApp((x) => x.setLunchAtHome);
  if (!household) return null;
  const { lunchAtHome, lunchDays } = household;
  const note =
    lunchAtHome === "yes"
      ? "Artan yemek, tarif öyle diyorsa ertesi gün öğlene yazılır."
      : lunchAtHome === "no"
        ? "Artanlar öğlene yazılmaz; dolaba kalır ve Bugün'de ne zamana kadar yenebileceği görünür."
        : lunchDays.length
          ? `Öğlene yalnızca ${lunchDays
              .slice()
              .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
              .map((d) => WEEKDAY_LONG[d])
              .join(", ")} yazılır; diğer günler artan dolaba kalır.`
          : "Günleri seçin; seçilmeyen günlerde artan dolaba kalır.";
  return (
    <div className={s.lunch}>
      <span className={s.label} id="ogle-soru">
        Öğlenleri evde yiyen var mı?
      </span>
      <div className={s.chips} role="group" aria-labelledby="ogle-soru">
        {LUNCH.map(([v, l]) => (
          <DishChip key={v} selected={lunchAtHome === v} onClick={() => setLunchAtHome({ lunchAtHome: v, lunchDays: v === "some" && !lunchDays.length ? [6, 0] : lunchDays })}>
            {l}
          </DishChip>
        ))}
      </div>
      {lunchAtHome === "some" && (
        <div className={s.chips} role="group" aria-label="Öğlen evde olunan günler">
          {WEEKDAYS.map(([d, l]) => (
            <DishChip
              key={d}
              selected={lunchDays.includes(d)}
              onClick={() => setLunchAtHome({ lunchAtHome: "some", lunchDays: lunchDays.includes(d) ? lunchDays.filter((x) => x !== d) : [...lunchDays, d] })}
            >
              <span aria-hidden="true">{l}</span>
              <span className="visually-hidden">{WEEKDAY_LONG[d]}</span>
            </DishChip>
          ))}
        </div>
      )}
      <p className={s.note}>{note}</p>
    </div>
  );
}

/** "Bu ay 12 tarif içe aktarıldı (11 Gemini, 1 kural)". */
function ImportUsage({ log }: { log: ImportLog[] }) {
  return (
    <p className={s.note} role="status">
      {importUsageText(log, toIsoDate(now()).slice(0, 7))}
    </p>
  );
}

export default function AyarlarPage() {
  const router = useRouter();
  const me = useApp((x) => x.me);
  const household = useApp((x) => x.household);
  const members = useApp((x) => x.members);
  const updateProfile = useApp((x) => x.updateProfile);
  const setDinnerTime = useApp((x) => x.setDinnerTime);
  const leaveHousehold = useApp((x) => x.leaveHousehold);
  const loadDemo = useApp((x) => x.loadDemo);
  const exportJson = useApp((x) => x.exportJson);
  const resetAll = useApp((x) => x.resetAll);
  const importLog = useApp((x) => x.importLog);
  const setNotice = useApp((x) => x.setNotice);
  const { people } = usePeople();
  const { theme, setTheme } = useTheme();
  const link = useInviteLink(household?.inviteCode);
  const [name, setName] = useState(me?.name ?? "");
  const [initial, setInitial] = useState(me?.avatarInitial ?? "");
  const [dinner, setDinner] = useState(household?.dinnerTime ?? "19:30");
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<"leave" | "reset" | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setNotice({ kind: "error", text: "Adın boş kalmasın." });
      return;
    }
    await updateProfile({ name: n, avatarInitial: (initial.trim() || initialOf(n)).slice(0, 2).toLocaleUpperCase("tr") });
    setNotice({ kind: "info", text: "Profilin güncellendi." });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.full);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setNotice({ kind: "info", text: "Kopyalayamadık; linki seçip elle kopyalayabilirsin." });
    }
  }

  async function download() {
    const json = await exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aksama-ne-var-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className={s.page}>
      <h1 className={s.title}>Ayarlar</h1>

      <section className={s.card} aria-labelledby="a-profil">
        <h2 id="a-profil" className={s.cardTitle}>
          Profil
        </h2>
        <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className={s.row}>
            <TextField label="Adın" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            <TextField label="Baş harf" value={initial} maxLength={2} onChange={(e) => setInitial(e.target.value)} />
          </div>
          <div className={s.buttons}>
            <Button type="submit" size="sm">
              Kaydet
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.replace("/giris?cikis=1")}
            >
              Çıkış yap
            </Button>
          </div>
        </form>
        <p className={s.note}>{me?.email}</p>
      </section>

      <section className={s.card} aria-labelledby="a-ev">
        <h2 id="a-ev" className={s.cardTitle}>
          Ev
        </h2>
        <ul className={s.members}>
          {people.map((p) => {
            const m = members.find((x) => x.userId === p.id);
            return (
              <li key={p.id} className={s.member}>
                <Avatar person={p} size={44} />
                <span className={s.memberTexts}>
                  <strong>
                    {p.name}
                    {p.id === me?.id ? " (sen)" : ""}
                  </strong>
                  <span>{m?.role === "owner" ? "Evi kuran" : "Davetle katıldı"}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {people.length < 2 ? (
          <>
            <label htmlFor="ayar-davet" className={s.label}>
              Davet linki
            </label>
            <div className={s.linkBox}>
              <IconLink size={18} />
              <input id="ayar-davet" readOnly value={link.display} className={s.linkInput} onFocus={(e) => e.target.select()} />
              <button type="button" className={s.copy} onClick={copy}>
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
            <a className={buttonClass({ size: "md" })} href={whatsappShareUrl(link.full)} target="_blank" rel="noopener noreferrer">
              <IconMessage size={18} />
              WhatsApp ile gönder
            </a>
          </>
        ) : (
          <p className={s.note}>Ev tamam: kararları ikiniz birlikte veriyorsunuz.</p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^\d{2}:\d{2}$/.test(dinner)) return;
            await setDinnerTime(dinner);
            setNotice({ kind: "info", text: `Sofra saati ${dinner}. Hatırlatmalar buna göre ayarlandı.` });
          }}
          style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}
        >
          <TextField label="Akşam sofrası saati" type="time" value={dinner} onChange={(e) => setDinner(e.target.value)} style={{ width: 140 }} />
          <Button type="submit" size="sm" variant="soft">
            Saati kaydet
          </Button>
        </form>
        <LunchSetting />
        {confirm === "leave" ? (
          <div className={s.confirm} role="alert">
            <p>Evden ayrılırsan plan, liste ve eşleşmeler bu evde kalır; sen yeni bir ev kurabilir ya da başka bir eve katılabilirsin.</p>
            <div className={s.buttons}>
              <Button
                size="sm"
                onClick={async () => {
                  await leaveHousehold();
                  router.replace("/onboarding/1");
                }}
              >
                Evet, ayrıl
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                Vazgeç
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="link" size="sm" className={s.danger} onClick={() => setConfirm("leave")} style={{ alignSelf: "flex-start" }}>
            Evden ayrıl
          </Button>
        )}
      </section>

      <section className={s.card} aria-labelledby="a-tema">
        <h2 id="a-tema" className={s.cardTitle}>
          Görünüm
        </h2>
        <div className={s.chips} role="group" aria-label="Tema">
          {THEMES.map(([v, l]) => (
            <DishChip key={v} selected={theme === v} onClick={() => setTheme(v)}>
              {l}
            </DishChip>
          ))}
        </div>
        <p className={s.note}>Sistem seçiliyse telefonun ya da bilgisayarın açık/koyu ayarını izler.</p>
      </section>

      <section className={s.card} aria-labelledby="a-ice">
        <h2 id="a-ice" className={s.cardTitle}>
          Linkten tarif
        </h2>
        <ImportUsage log={importLog} />
        <Link href="/tarifler/ice-aktar" className={buttonClass({ size: "sm", variant: "soft" })} style={{ alignSelf: "flex-start" }}>
          Linkten ekle
        </Link>
      </section>

      <section className={s.card} aria-labelledby="a-veri">
        <h2 id="a-veri" className={s.cardTitle}>
          Veri
        </h2>
        <p className={s.note}>
          Bu bir demo: her şey yalnızca bu tarayıcıda durur. Şifreler karıştırılarak saklanır ama bu gerçek bir güvenlik sağlamaz.
        </p>
        <div className={s.buttons}>
          <Button
            size="sm"
            variant="soft"
            onClick={async () => {
              await loadDemo();
              router.replace("/bugun");
            }}
          >
            Demo verisini yükle
          </Button>
          <Button size="sm" variant="soft" onClick={download}>
            JSON olarak dışa aktar
          </Button>
          <Link href="/akis" className={buttonClass({ size: "sm", variant: "soft" })}>
            Ev hareketleri
          </Link>
        </div>
        <p className={s.note}>{"Demo, Ali ve Zeynep'in evini yükler ve seni Ali olarak açar (ali@demo.ev / zeynep@demo.ev · şifre demo1234)."}</p>
        {confirm === "reset" ? (
          <div className={s.confirm} role="alert">
            <p>Bu tarayıcıdaki bütün hesaplar, evler, planlar ve listeler silinir. Geri alınamaz.</p>
            <div className={s.buttons}>
              <Button
                size="sm"
                onClick={async () => {
                  await resetAll();
                  router.replace("/giris");
                }}
              >
                Evet, hepsini sil
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                Vazgeç
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="link" size="sm" className={s.danger} onClick={() => setConfirm("reset")} style={{ alignSelf: "flex-start" }}>
            Tüm verileri sıfırla
          </Button>
        )}
      </section>
    </main>
  );
}
