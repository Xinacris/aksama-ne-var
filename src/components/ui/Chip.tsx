import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconCheck, IconGrip, IconHeart } from "../icons";
import s from "./Chip.module.css";

/** Selectable dish chip (onboarding, filters): default ↔ selected (aria-pressed). */
export function DishChip({
  selected,
  children,
  className,
  ...rest
}: { selected: boolean; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type="button" aria-pressed={selected} className={[s.chip, className].filter(Boolean).join(" ")} {...rest}>
      {selected && <IconCheck size={16} strokeWidth={2.6} />}
      {children}
    </button>
  );
}

export type TagVariant = "draggable" | "match" | "leftover";

/** Non-pressable dish tag: draggable (sand), from a match (tomato heart), leftover (olive). */
export function DishTag({
  variant,
  children,
  className,
  ...rest
}: { variant: TagVariant; children: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={[s.tag, s[variant], className].filter(Boolean).join(" ")} {...rest}>
      {variant === "draggable" && <IconGrip size={12} strokeWidth={3.5} />}
      {variant === "match" && <IconHeart size={14} />}
      {children}
    </span>
  );
}

/** Small sand pill used for recipe tags ("Fırında", "Kıymalı"). */
export function TagPill({ children }: { children: ReactNode }) {
  return <span className={s.small}>{children}</span>;
}

export type StatusTone = "olive" | "sand" | "tomato";
const TONE = { olive: s.statusOlive, sand: s.statusSand, tomato: s.statusTomato };

/** Status pill ("Evde var", "Listede", "Eksik"). */
export function StatusPill({ tone, children, onClick, label }: { tone: StatusTone; children: ReactNode; onClick?: () => void; label?: string }) {
  if (onClick) {
    return (
      <button type="button" className={`${s.status} ${TONE[tone]}`} onClick={onClick} aria-label={label}>
        {children}
      </button>
    );
  }
  return <span className={`${s.status} ${TONE[tone]}`}>{children}</span>;
}
