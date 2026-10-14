import { AppShell } from "@/components/AppShell";
import { Guard } from "@/components/Guard";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Guard need="household">
      <AppShell>{children}</AppShell>
    </Guard>
  );
}
