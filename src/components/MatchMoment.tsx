"use client";

import { useEffect, useRef } from "react";
import { IconHeart } from "./icons";
import { Avatar, type AvatarPerson } from "./ui/Avatar";
import s from "./MatchMoment.module.css";

const CONFETTI: { style: React.CSSProperties; color: string }[] = [
  { style: { left: 12, top: 14, width: 10, height: 5, transform: "rotate(-30deg)" }, color: "var(--tomato)" },
  { style: { right: 18, top: 6, width: 8, height: 5, transform: "rotate(25deg)" }, color: "var(--sand)" },
  { style: { left: 30, bottom: 6, width: 9, height: 5, transform: "rotate(40deg)" }, color: "var(--olive)" },
  { style: { right: 8, bottom: 22, width: 10, height: 5, transform: "rotate(-12deg)" }, color: "var(--tomato)" },
  { style: { left: 92, top: -4, width: 7, height: 4, transform: "rotate(60deg)" }, color: "var(--sand)" },
];

/** "İkiniz de karnıyarık dediniz!" — the match moment from Eslesme-Eslesti.dc.html. */
export function MatchMoment({
  people,
  title,
  subtitle,
  dishName,
  meta,
  listNote,
  putLabel,
  onPut,
  onContinue,
  busy,
}: {
  people: AvatarPerson[];
  title: string;
  subtitle: string;
  dishName: string;
  meta: string;
  listNote: string;
  putLabel: string;
  onPut: () => void;
  onContinue: () => void;
  busy?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section className={s.moment} aria-labelledby="eslesme-baslik" role="region">
      <div className={s.hero}>
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={s.confetti}
            style={{ ...c.style, background: c.color, animationDelay: `${80 + i * 60}ms` }}
          />
        ))}
        <div className={s.avatars}>
          {people.map((p) => (
            <Avatar key={p.id} person={p} size={76} className={s.avatar} />
          ))}
        </div>
        <span className={s.heart} aria-hidden="true">
          <IconHeart size={18} />
        </span>
      </div>
      <div className={s.texts}>
        <h1 id="eslesme-baslik" className={s.title} tabIndex={-1} ref={headingRef}>
          {title}
        </h1>
        <p className={s.sub}>{subtitle}</p>
      </div>
      <div className={s.card}>
        <div className={`ph ${s.thumb}`} aria-hidden="true" />
        <div className={s.cardBody}>
          <span className={s.cardName}>{dishName}</span>
          <span className={s.cardMeta}>{meta}</span>
          <span className={s.cardMeta}>{listNote}</span>
        </div>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.put} onClick={onPut} disabled={busy}>
          {putLabel}
        </button>
        <button type="button" className={s.continue} onClick={onContinue}>
          Kaydırmaya devam
        </button>
      </div>
    </section>
  );
}
