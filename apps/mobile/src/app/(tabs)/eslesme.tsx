import { useApp } from "@/store";
import { Screen, Text } from "@/ui";

export default function Placeholder() {
  const household = useApp((s) => s.household);
  return (
    <Screen header>
      <Text variant="eyebrow">{household?.name ?? ""}</Text>
      <Text variant="title">eslesme</Text>
    </Screen>
  );
}
