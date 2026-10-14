import { useState } from "react";
import { useApp } from "@/store";
import { Button, Screen, Text } from "@/ui";

export default function Giris() {
  const loadDemo = useApp((s) => s.loadDemo);
  const [busy, setBusy] = useState(false);
  return (
    <Screen header>
      <Text variant="display">Akşama ne var?</Text>
      <Button
        title="Örnek evle dene · Ali ve Zeynep"
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
