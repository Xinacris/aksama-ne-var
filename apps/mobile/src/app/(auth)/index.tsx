import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store";
import { Button, Screen, Text } from "@/ui";

export default function Giris() {
  const loadDemo = useApp((s) => s.loadDemo);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();
  return (
    <Screen header>
      <Text variant="display">{t("app.name")}</Text>
      <Button
        title={t("giris.demo")}
        busy={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await loadDemo();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
