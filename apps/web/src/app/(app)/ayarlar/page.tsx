"use client";

import { listJoin, t } from "@anv/core/i18n";
import { weekdayName } from "@anv/core/domain/dates";
import { LanguageSetting } from "@/components/LanguageSetting";
import { TimerSoundSetting } from "@/components/TimerSoundSetting";
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
import { initialOf } from "@anv/core/services/auth";
import { whatsappShareUrl } from "@anv/core/services/household";
import { useApp } from "@/store/app";
import type { Household, ImportLog } from "@anv/core/data/models";
import { toIsoDate } from "@anv/core/domain/dates";
import { importUsageText } from "@anv/core/domain/import/usage";
import { now } from "@anv/core/lib/clock";
import type { ThemePreference } from "@anv/core/lib/theme";
import s from "./page.module.css";

const THEMES: ThemePreference[] = ["light", "dark", "system"];

const LUNCH: Household["lunchAtHome"][] = ["yes", "no", "some"];
// Monday first, in both languages.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** "Öğlenleri evde yiyen var mı?" — decides whether leftovers become a lunch or go in the fridge. */
function LunchSetting() {
  const household = useApp((x) => x.household);
  const setLunchAtHome = useApp((x) => x.setLunchAtHome);
  if (!household) return null;
  const { lunchAtHome, lunchDays } = household;
  const note =
    lunchAtHome === "yes"
      ? t("ayarlar.lunchYes")
      : lunchAtHome === "no"
        ? t("ayarlar.lunchNo")
        : lunchDays.length
          ? t("ayarlar.lunchSome", {
              days: listJoin(
                lunchDays
                  .slice()
                  .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                  .map((d) => weekdayName(d)),
              ),
            })
          : t("ayarlar.lunchPick");
  return (
    <div className={s.lunch}>
      <span className={s.label} id="ogle-soru">
        {t("ayarlar.lunchQ")}
      </span>
      <div className={s.chips} role="group" aria-labelledby="ogle-soru">
        {LUNCH.map((v) => (
          <DishChip key={v} selected={lunchAtHome === v} onClick={() => setLunchAtHome({ lunchAtHome: v, lunchDays: v === "some" && !lunchDays.length ? [6, 0] : lunchDays })}>
            {t(`lunch.${v}`)}
          </DishChip>
        ))}
      </div>
      {lunchAtHome === "some" && (
        <div className={s.chips} role="group" aria-label={t("ayarlar.lunchDays")}>
          {WEEKDAYS.map((d) => (
            <DishChip
              key={d}
              selected={lunchDays.includes(d)}
              onClick={() => setLunchAtHome({ lunchAtHome: "some", lunchDays: lunchDays.includes(d) ? lunchDays.filter((x) => x !== d) : [...lunchDays, d] })}
            >
              <span aria-hidden="true">{weekdayName(d, "short")}</span>
              <span className="visually-hidden">{weekdayName(d)}</span>
            </DishChip>
          ))}
        </div>
      )}
      <p className={s.note}>{note}</p>
    </div>
  );
}

/** "Alkollü malzemelerde alternatifi kullan": the shopping list takes the alcohol-free substitutes. */
function AlcoholFreeSetting() {
  const household = useApp((x) => x.household);
  const setAlcoholFree = useApp((x) => x.setAlcoholFreeSubstitutes);
  if (!household) return null;
  const on = household.alcoholFreeSubstitutes === true;
  return (
    <div className={s.lunch}>
      <span className={s.label} id="alkol-soru">
        {t("ayarlar.alcoholFree")}
      </span>
      <div className={s.chips} role="group" aria-labelledby="alkol-soru">
        <DishChip selected={on} onClick={() => void setAlcoholFree(true)}>
          {t("ayarlar.on")}
        </DishChip>
        <DishChip selected={!on} onClick={() => void setAlcoholFree(false)}>
          {t("ayarlar.off")}
        </DishChip>
      </div>
      <p className={s.note}>{t("ayarlar.alcoholFreeNote")}</p>
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
      setNotice({ kind: "error", text: t("ayarlar.nameEmpty") });
      return;
    }
    await updateProfile({ name: n, avatarInitial: (initial.trim() || initialOf(n)).slice(0, 2).toLocaleUpperCase("tr") });
    setNotice({ kind: "info", text: t("ayarlar.profileSaved") });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.full);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setNotice({ kind: "info", text: t("ayarlar.copyFailed") });
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
      <h1 className={s.title}>{t("ayarlar.title")}</h1>

      <section className={s.card} aria-labelledby="a-profil">
        <h2 id="a-profil" className={s.cardTitle}>
          {t("ayarlar.profile")}
        </h2>
        <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className={s.row}>
            <TextField label={t("auth.yourName")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            <TextField label={t("ayarlar.initial")} value={initial} maxLength={2} onChange={(e) => setInitial(e.target.value)} />
          </div>
          <div className={s.buttons}>
            <Button type="submit" size="sm">
              {t("ayarlar.save")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.replace("/giris?cikis=1")}
            >
              {t("ayarlar.logOut")}
            </Button>
          </div>
        </form>
        <p className={s.note}>{me?.email}</p>
      </section>

      <section className={s.card} aria-labelledby="a-ev">
        <h2 id="a-ev" className={s.cardTitle}>
          {t("ayarlar.household")}
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
                    {p.id === me?.id ? t("ayarlar.you") : ""}
                  </strong>
                  <span>{m?.role === "owner" ? t("ayarlar.owner") : t("ayarlar.joined")}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {people.length < 2 ? (
          <>
            <label htmlFor="ayar-davet" className={s.label}>
              {t("onb2.inviteLink")}
            </label>
            <div className={s.linkBox}>
              <IconLink size={18} />
              <input id="ayar-davet" readOnly value={link.display} className={s.linkInput} onFocus={(e) => e.target.select()} />
              <button type="button" className={s.copy} onClick={copy}>
                {copied ? t("onb2.copied") : t("onb2.copy")}
              </button>
            </div>
            <a className={buttonClass({ size: "md" })} href={whatsappShareUrl(link.full)} target="_blank" rel="noopener noreferrer">
              <IconMessage size={18} />
              {t("onb2.whatsapp")}
            </a>
          </>
        ) : (
          <p className={s.note}>{t("ayarlar.complete")}</p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^\d{2}:\d{2}$/.test(dinner)) return;
            await setDinnerTime(dinner);
            setNotice({ kind: "info", text: t("ayarlar.dinnerSaved", { time: dinner }) });
          }}
          style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}
        >
          <TextField label={t("ayarlar.dinnerTime")} type="time" value={dinner} onChange={(e) => setDinner(e.target.value)} style={{ width: 140 }} />
          <Button type="submit" size="sm" variant="soft">
            {t("ayarlar.saveTime")}
          </Button>
        </form>
        <LunchSetting />
        <AlcoholFreeSetting />
        {confirm === "leave" ? (
          <div className={s.confirm} role="alert">
            <p>{t("ayarlar.leaveText")}</p>
            <div className={s.buttons}>
              <Button
                size="sm"
                onClick={async () => {
                  await leaveHousehold();
                  router.replace("/onboarding/1");
                }}
              >
                {t("ayarlar.leaveYes")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                {t("form.bulk.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="link" size="sm" className={s.danger} onClick={() => setConfirm("leave")} style={{ alignSelf: "flex-start" }}>
            {t("ayarlar.leave")}
          </Button>
        )}
      </section>

      <section className={s.card} aria-labelledby="a-tema">
        <h2 id="a-tema" className={s.cardTitle}>
          {t("ayarlar.appearance")}
        </h2>
        <div className={s.chips} role="group" aria-label={t("ayarlar.theme")}>
          {THEMES.map((v) => (
            <DishChip key={v} selected={theme === v} onClick={() => setTheme(v)}>
              {t(`theme.${v}`)}
            </DishChip>
          ))}
        </div>
        <p className={s.note}>{t("ayarlar.themeNote")}</p>
      </section>

      <LanguageSetting />

      <TimerSoundSetting />

      <section className={s.card} aria-labelledby="a-ice">
        <h2 id="a-ice" className={s.cardTitle}>
          {t("ayarlar.import")}
        </h2>
        <ImportUsage log={importLog} />
        <Link href="/tarifler/ice-aktar" className={buttonClass({ size: "sm", variant: "soft" })} style={{ alignSelf: "flex-start" }}>
          {t("tarifler.fromLink")}
        </Link>
      </section>

      <section className={s.card} aria-labelledby="a-veri">
        <h2 id="a-veri" className={s.cardTitle}>
          {t("ayarlar.data")}
        </h2>
        <p className={s.note}>
          {t("ayarlar.dataNote")}
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
            {t("ayarlar.loadDemo")}
          </Button>
          <Button size="sm" variant="soft" onClick={download}>
            {t("ayarlar.export")}
          </Button>
          <Link href="/akis" className={buttonClass({ size: "sm", variant: "soft" })}>
            {t("ayarlar.activity")}
          </Link>
        </div>
        <p className={s.note}>{t("ayarlar.demoNote")}</p>
        {confirm === "reset" ? (
          <div className={s.confirm} role="alert">
            <p>{t("ayarlar.resetText")}</p>
            <div className={s.buttons}>
              <Button
                size="sm"
                onClick={async () => {
                  await resetAll();
                  router.replace("/giris");
                }}
              >
                {t("ayarlar.resetYes")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                {t("form.bulk.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="link" size="sm" className={s.danger} onClick={() => setConfirm("reset")} style={{ alignSelf: "flex-start" }}>
            {t("ayarlar.reset")}
          </Button>
        )}
      </section>
    </main>
  );
}
