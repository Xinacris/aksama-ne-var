"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { usePeople } from "@/hooks/usePeople";
import { usePartnerPresence } from "@/hooks/usePresence";
import { selectList, useApp } from "@/store/app";
import { IconBasket, IconBook, IconCalendar, IconCards, IconHome, IconSettings } from "./icons";
import { AvatarStack } from "./ui/Avatar";
import { SyncInline } from "./ui/Misc";
import s from "./AppShell.module.css";

/** Phone tabs. `also`: other route roots that light the same tab (a recipe page belongs to Tarifler). */
const TABS: { href: string; label: string; Icon: typeof IconHome; also?: string[] }[] = [
  { href: "/bugun", label: "Bugün", Icon: IconHome },
  { href: "/eslesme", label: "Eşleş", Icon: IconCards },
  { href: "/liste", label: "Liste", Icon: IconBasket },
  { href: "/tarifler", label: "Tarifler", Icon: IconBook, also: ["/tarif"] },
  { href: "/hafta", label: "Hafta", Icon: IconCalendar },
];

/** Desktop order follows the weekly board header: Bugün, Hafta, Eşleş, Liste (+ Tarifler). */
const TOP = [
  { href: "/bugun", label: "Bugün" },
  { href: "/hafta", label: "Hafta" },
  { href: "/eslesme", label: "Eşleş" },
  { href: "/liste", label: "Liste" },
  { href: "/tarifler", label: "Tarifler" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function useListBadge(): number {
  const state = useApp();
  return useMemo(() => selectList(state).filter((r) => !r.checkedBy).length, [state]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const badge = useListBadge();
  const sync = useApp((st) => st.sync);
  const { people } = usePeople();
  const partner = usePartnerPresence();
  const names = people.map((p) => p.name).join(" ve ");

  return (
    <div className={s.shell}>
      <header className={s.top}>
        <div className={s.topInner}>
          <div className={s.topLeft}>
            <Link href="/bugun" className={s.brand}>
              Akşama ne var?
            </Link>
            <nav aria-label="Ana gezinme" className={s.topNav}>
              {TOP.map((t) => (
                <Link key={t.href} href={t.href} className={s.pill} aria-current={isActive(pathname, t.href) ? "page" : undefined}>
                  {t.label}
                  {t.href === "/liste" && badge > 0 && <span className={s.pillBadge}>{badge}</span>}
                </Link>
              ))}
            </nav>
          </div>
          <div className={s.topRight}>
            <SyncInline state={sync} suffix={partner ? `${partner.name} de burada` : undefined} />
            <Link href="/ayarlar" className={s.avatarLink} aria-label={`Ev halkı: ${names} · Ayarlar`}>
              <AvatarStack people={people} size={34} ringIds={partner ? [partner.id] : []} />
            </Link>
            <Link href="/ayarlar" className={s.iconLink} aria-label="Ayarlar" aria-current={isActive(pathname, "/ayarlar") ? "page" : undefined}>
              <IconSettings size={20} />
            </Link>
          </div>
        </div>
      </header>
      <div className={s.content}>{children}</div>
      <nav aria-label="Ana gezinme" className={s.bottom}>
        {TABS.map(({ href, label, Icon, also }) => {
          const active = [href, ...(also ?? [])].some((h) => isActive(pathname, h));
          return (
            <Link key={href} href={href} className={s.tab} aria-current={active ? "page" : undefined}>
              <Icon size={22} strokeWidth={active ? 1.9 : 1.8} />
              {label}
              {href === "/liste" && badge > 0 && (
                <span className={s.badge} aria-label={`${badge} ürün kaldı`}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
