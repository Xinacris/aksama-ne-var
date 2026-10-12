import Link from "next/link";
import type { ReactNode } from "react";
import { SLOT_LABEL, type Slot } from "@/data/models";
import { IconArrowRight, IconCheck } from "./icons";
import { PhotoPlaceholder } from "./ui/Misc";
import s from "./MenuCard.module.css";

export interface MenuRow {
  slot: Slot;
  name: string | null;
  href?: string;
  time?: string;
}

export type Approval = { tone: "ok" | "wait"; label: string } | null;

function ApprovalPill({ approval }: { approval: Approval }) {
  if (!approval) return null;
  if (approval.tone === "ok")
    return (
      <span className={s.pillOk}>
        <IconCheck size={14} strokeWidth={2.4} />
        {approval.label}
      </span>
    );
  return <span className={s.pillWait}>{approval.label}</span>;
}

function Rows({ rows, withTime }: { rows: MenuRow[]; withTime: boolean }) {
  return (
    <ul className={s.list}>
      {rows.map((r) => (
        <li key={r.slot} className={[s.row, r.slot === "ana" && s.main].filter(Boolean).join(" ")}>
          <span className={s.slot}>{SLOT_LABEL[r.slot]}</span>
          {r.name === null ? (
            <span className={s.missing}>Silinmiş tarif</span>
          ) : r.href ? (
            <Link href={r.href} className={s.dish}>
              {r.name}
            </Link>
          ) : (
            <span>{r.name}</span>
          )}
          {withTime && <span className={s.time}>{r.time}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Compact menu card from Componentler ("Salı akşamı · Karnıyarık sofrası"). */
export function MenuCard({
  dayLabel,
  title,
  rows,
  approval,
  headingLevel = 3,
  footer,
}: {
  dayLabel: string;
  title: string;
  rows: MenuRow[];
  approval: Approval;
  headingLevel?: 2 | 3;
  footer?: ReactNode;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={`${s.card} ${s.compact}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>{dayLabel}</span>
        <ApprovalPill approval={approval} />
      </div>
      <H className={s.title}>{title}</H>
      <Rows rows={rows} withTime={false} />
      {footer}
    </article>
  );
}

/** Tonight's card from Main.dc.html: photo, per-dish times, approval and a link to the menu detail. */
export function TonightCard({
  photoDish,
  title,
  rows,
  approval,
  href,
  action,
}: {
  photoDish: string;
  title: string;
  rows: MenuRow[];
  approval: Approval;
  href: string;
  action?: ReactNode;
}) {
  return (
    <article className={`${s.card} ${s.tonight}`}>
      <PhotoPlaceholder dish={photoDish} height={136} />
      <div className={s.body}>
        <div className={s.head}>
          <span className={s.eyebrow}>Bu akşam</span>
          <ApprovalPill approval={approval} />
        </div>
        <h2 className={s.title}>{title}</h2>
        <Rows rows={rows} withTime />
        {action}
        <Link href={href} className={s.open}>
          Menüyü ve ön hazırlığı aç
          <IconArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}

export const menuCardStyles = s;
