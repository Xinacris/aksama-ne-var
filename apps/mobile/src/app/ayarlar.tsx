import { Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Household } from "@anv/core/data/models";
import { toIsoDate, weekdayName } from "@anv/core/domain/dates";
import { importUsageText } from "@anv/core/domain/import/usage";
import { getLocale, listJoin, LOCALES } from "@anv/core/i18n";
import { now } from "@anv/core/lib/clock";
import type { ThemePreference } from "@anv/core/lib/theme";
import { useTimerSound } from "@/alarm/prefs";
import { useMobileData } from "@/boot";
import { usePeople } from "@/hooks/usePeople";
import { useSetLanguage } from "@/i18n";
import { useApp } from "@/store";
import { useTheme } from "@/theme";
import { Button, Card, Chip, Field, Row, Screen, Text } from "@/ui";
import { Avatar } from "@/ui/more";

const THEMES: ThemePreference[] = ["light", "dark", "system"];
const LUNCH: Household["lunchAtHome"][] = ["yes", "no", "some"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** Ayarlar: profile, household (invite code, dinner time, lunch), language, theme, import usage, sync note, data. */
export default function Settings() {
  const { t } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const data = useMobileData();
  const setLanguage = useSetLanguage(data?.store ?? null);
  const st = useApp();
  const [timerSound, setTimerSound] = useTimerSound();
  const { me, household, members, importLog } = st;
  const { people } = usePeople();
  const [name, setName] = useState(me?.name ?? "");
  const [dinner, setDinner] = useState(household?.dinnerTime ?? "19:30");
  const [confirm, setConfirm] = useState<"leave" | "reset" | null>(null);
  const lang = getLocale();

  const lunchNote = !household
    ? ""
    : household.lunchAtHome === "yes"
      ? t("ayarlar.lunchYes")
      : household.lunchAtHome === "no"
        ? t("ayarlar.lunchNo")
        : household.lunchDays.length
          ? t("ayarlar.lunchSome", { days: listJoin([...household.lunchDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => weekdayName(d))) })
          : t("ayarlar.lunchPick");

  return (
    <Screen>
      <Stack.Screen options={{ title: t("ayarlar.title") }} />

      <Card>
        <Text variant="h3">{t("ayarlar.profile")}</Text>
        <Field label={t("auth.yourName")} value={name} onChangeText={setName} />
        <Row>
          <Button
            title={t("ayarlar.save")}
            size="sm"
            onPress={async () => {
              const n = name.trim();
              if (!n) return st.setNotice({ kind: "error", text: t("ayarlar.nameEmpty") });
              await st.updateProfile({ name: n, avatarInitial: n.charAt(0).toLocaleUpperCase("tr") });
              st.setNotice({ kind: "info", text: t("ayarlar.profileSaved") });
            }}
          />
          <Button title={t("ayarlar.logOut")} size="sm" variant="secondary" onPress={() => st.logOut()} />
        </Row>
        <Text variant="small">{me?.email}</Text>
      </Card>

      <Card tone="sand" style={{ borderWidth: 0 }}>
        <Text variant="h3">{t("mobile.sync.title")}</Text>
        <Text variant="bodySmall">{t("mobile.sync.text")}</Text>
      </Card>

      {household && (
        <Card>
          <Text variant="h3">{t("ayarlar.household")}</Text>
          {people.map((p) => (
            <Row key={p.id} style={{ flexWrap: "nowrap" }}>
              <Avatar person={p} size={40} />
              <View style={{ flex: 1 }}>
                <Text weight="bold">
                  {p.name}
                  {p.id === me?.id ? t("ayarlar.you") : ""}
                </Text>
                <Text variant="meta">{members.find((m) => m.userId === p.id)?.role === "owner" ? t("ayarlar.owner") : t("ayarlar.joined")}</Text>
              </View>
            </Row>
          ))}
          {people.length < 2 ? <Text selectable weight="semibold">{t("mobile.inviteCode", { code: household.inviteCode })}</Text> : <Text variant="meta">{t("ayarlar.complete")}</Text>}
          <Row style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Field label={t("ayarlar.dinnerTime")} value={dinner} onChangeText={setDinner} keyboardType="numbers-and-punctuation" placeholder="19:30" />
            </View>
            <Button
              title={t("ayarlar.saveTime")}
              size="sm"
              variant="soft"
              onPress={async () => {
                if (!/^\d{2}:\d{2}$/.test(dinner)) return;
                await st.setDinnerTime(dinner);
                st.setNotice({ kind: "info", text: t("ayarlar.dinnerSaved", { time: dinner }) });
              }}
            />
          </Row>
          <Text variant="label">{t("ayarlar.lunchQ")}</Text>
          <Row>
            {LUNCH.map((v) => (
              <Chip
                key={v}
                label={t(`lunch.${v}`)}
                selected={household.lunchAtHome === v}
                onPress={() => st.setLunchAtHome({ lunchAtHome: v, lunchDays: v === "some" && !household.lunchDays.length ? [6, 0] : household.lunchDays })}
              />
            ))}
          </Row>
          {household.lunchAtHome === "some" && (
            <Row>
              {WEEKDAYS.map((d) => (
                <Chip
                  key={d}
                  tone="olive"
                  label={weekdayName(d, "short")}
                  selected={household.lunchDays.includes(d)}
                  onPress={() =>
                    st.setLunchAtHome({
                      lunchAtHome: "some",
                      lunchDays: household.lunchDays.includes(d) ? household.lunchDays.filter((x) => x !== d) : [...household.lunchDays, d],
                    })
                  }
                />
              ))}
            </Row>
          )}
          <Text variant="small">{lunchNote}</Text>
          {confirm === "leave" ? (
            <View style={{ gap: 8 }}>
              <Text variant="bodySmall">{t("ayarlar.leaveText")}</Text>
              <Row>
                <Button title={t("ayarlar.leaveYes")} size="sm" onPress={() => st.leaveHousehold()} />
                <Button title={t("form.bulk.cancel")} size="sm" variant="secondary" onPress={() => setConfirm(null)} />
              </Row>
            </View>
          ) : (
            <Button title={t("ayarlar.leave")} variant="ghost" size="sm" onPress={() => setConfirm("leave")} />
          )}
        </Card>
      )}

      <Card>
        <Text variant="h3">{t("ayarlar.language")}</Text>
        <Row>
          {LOCALES.map((l) => (
            <Chip key={l} label={t(`language.${l}`)} selected={lang === l} onPress={() => setLanguage(l)} />
          ))}
        </Row>
        <Text variant="small">{t("ayarlar.languageNote")}</Text>
      </Card>

      <Card>
        <Text variant="h3">{t("ayarlar.appearance")}</Text>
        <Row>
          {THEMES.map((v) => (
            <Chip key={v} label={t(`theme.${v}`)} selected={preference === v} onPress={() => setPreference(v)} />
          ))}
        </Row>
        <Text variant="small">{t("ayarlar.themeNote")}</Text>
      </Card>

      <Card>
        <Text variant="h3">{t("ayarlar.cooking")}</Text>
        <Text weight="semibold">{t("ayarlar.timerSound")}</Text>
        <Row>
          <Chip label={t("ayarlar.on")} selected={timerSound} onPress={() => setTimerSound(true)} />
          <Chip label={t("ayarlar.off")} selected={!timerSound} onPress={() => setTimerSound(false)} />
        </Row>
        <Text variant="small">{t("ayarlar.timerSoundNote")}</Text>
      </Card>

      <Card>
        <Text variant="h3">{t("ayarlar.import")}</Text>
        <Text variant="bodySmall" accessibilityLiveRegion="polite">
          {importUsageText(importLog, toIsoDate(now()).slice(0, 7))}
        </Text>
      </Card>

      <Card>
        <Text variant="h3">{t("ayarlar.data")}</Text>
        <Text variant="small">{t("mobile.data.note")}</Text>
        <Button title={t("ayarlar.loadDemo")} size="sm" variant="soft" onPress={() => st.loadDemo()} />
        <Text variant="small">{t("ayarlar.demoNote")}</Text>
        {confirm === "reset" ? (
          <View style={{ gap: 8 }}>
            <Text variant="bodySmall">{t("mobile.data.resetText")}</Text>
            <Row>
              <Button title={t("ayarlar.resetYes")} size="sm" onPress={() => st.resetAll()} />
              <Button title={t("form.bulk.cancel")} size="sm" variant="secondary" onPress={() => setConfirm(null)} />
            </Row>
          </View>
        ) : (
          <Button title={t("ayarlar.reset")} variant="ghost" size="sm" onPress={() => setConfirm("reset")} />
        )}
      </Card>
      <View style={{ height: 8, backgroundColor: colors.bg }} />
    </Screen>
  );
}
