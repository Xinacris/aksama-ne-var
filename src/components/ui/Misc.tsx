"use client";

import type { ReactNode } from "react";
import { IconClose, IconEmptyPlate, IconOffline, IconSync } from "../icons";
import { Avatar, type AvatarPerson } from "./Avatar";
import s from "./Misc.module.css";

export type SyncState = "live" | "syncing" | "offline";

/** Pill variant from Componentler (Canlı / Eşitleniyor / Çevrimdışı · n değişiklik sırada). */
export function SyncIndicator({ state, pending = 0, liveLabel = "Canlı" }: { state: SyncState; pending?: number; liveLabel?: string }) {
  if (state === "syncing")
    return (
      <span role="status" className={`${s.sync} ${s.syncSyncing}`}>
        <IconSync size={14} className={s.spin} />
        Eşitleniyor
      </span>
    );
  if (state === "offline")
    return (
      <span role="status" className={`${s.sync} ${s.syncOffline}`}>
        <IconOffline size={14} />
        Çevrimdışı{pending ? ` · ${pending} değişiklik sırada` : ""}
      </span>
    );
  return (
    <span role="status" className={`${s.sync} ${s.syncLive}`}>
      <span className={s.dot} />
      {liveLabel}
    </span>
  );
}

/** Compact header variant ("● Senkron", "● Senkron · Zeynep de burada"). */
export function SyncInline({ state, suffix }: { state: SyncState; suffix?: string }) {
  const cls = state === "syncing" ? s.syncingText : state === "offline" ? s.offlineText : "";
  const label = state === "syncing" ? "Eşitleniyor" : state === "offline" ? "Çevrimdışı" : "Senkron";
  return (
    <span role="status" className={`${s.syncInline} ${cls}`}>
      {state === "syncing" ? <IconSync size={12} className={s.spin} /> : <span className={s.dot} />}
      {label}
      {suffix && state === "live" ? ` · ${suffix}` : ""}
    </span>
  );
}

export function ActivityLine({
  person,
  text,
  when,
  size = 26,
  className,
}: {
  person: Pick<AvatarPerson, "initial" | "color" | "name">;
  text: string;
  when?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={[s.activity, className].filter(Boolean).join(" ")}>
      <Avatar person={person} size={size} />
      <p>
        <strong>{person.name}</strong> {text}
        {when ? ` · ${when}` : ""}
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  icon,
  actions,
  className,
  headingLevel = 2,
}: {
  title: string;
  text?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={[s.empty, className].filter(Boolean).join(" ")}>
      <span className={s.emptyIcon}>{icon ?? <IconEmptyPlate size={28} />}</span>
      <H className={s.emptyTitle}>{title}</H>
      {text && <p className={s.emptyText}>{text}</p>}
      {actions && <div className={s.emptyActions}>{actions}</div>}
    </div>
  );
}

/** Diagonal-stripe photo placeholder with "Fotoğraf · <dish>" pill. No real photos are fetched. */
export function PhotoPlaceholder({
  dish,
  height,
  radius,
  className,
  style,
  pill = true,
}: {
  dish?: string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
  pill?: boolean;
}) {
  return (
    <div
      className={["ph", s.photo, className].filter(Boolean).join(" ")}
      style={{ height, borderRadius: radius, ...style }}
      role={dish ? "img" : undefined}
      aria-label={dish ? `Fotoğraf yeri: ${dish}` : undefined}
    >
      {pill && dish && <span className={s.photoPill}>Fotoğraf · {dish}</span>}
    </div>
  );
}

export function Eyebrow({ children, muted, as: As = "span", className }: { children: ReactNode; muted?: boolean; as?: "span" | "h2" | "p"; className?: string }) {
  return <As className={[s.eyebrow, muted && s.eyebrowMuted, className].filter(Boolean).join(" ")} style={As !== "span" ? { margin: 0 } : undefined}>{children}</As>;
}

export function Notice({ kind, text, onClose }: { kind: "error" | "info"; text: string; onClose: () => void }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={[s.notice, kind === "error" && s.noticeError].filter(Boolean).join(" ")}>
      <p>{text}</p>
      <button type="button" className={s.noticeClose} onClick={onClose} aria-label="Kapat">
        <IconClose size={18} />
      </button>
    </div>
  );
}
