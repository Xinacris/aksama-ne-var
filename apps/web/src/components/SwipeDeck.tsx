"use client";

import { t as tr } from "@anv/core/i18n";
import { useEffect, useRef, useState } from "react";
import type { Recipe } from "@anv/core/data/models";
import { IconClock, IconClose, IconHeart, IconHistory } from "./icons";
import { TagPill } from "./ui/Chip";
import { PhotoPlaceholder } from "./ui/Misc";
import s from "./SwipeDeck.module.css";

export interface DeckCard {
  recipe: Recipe;
  time: string;
  last: string;
  tags: string[];
}

const THRESHOLD = 100;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The swipe card from Eslesme.dc.html. Drag (pointer/touch), the two
 * buttons, and ←/→ on the keyboard all decide the same way.
 * Render with `key={recipe.id}` so each card starts with fresh motion state.
 */
export function SwipeDeck({
  card,
  remaining,
  onDecide,
  disabled = false,
}: {
  card: DeckCard;
  remaining: number;
  onDecide: (decision: "like" | "pass") => void;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<"like" | "pass" | null>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const decided = useRef(false);

  function decide(d: "like" | "pass") {
    if (decided.current || disabled) return;
    decided.current = true;
    if (prefersReducedMotion()) {
      onDecide(d);
      return;
    }
    setLeaving(d);
    setTimeout(() => onDecide(d), 230);
  }

  // Keyboard: ← pass, → like (ignored while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        decide("like");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        decide("pass");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || decided.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dt = Math.max(1, performance.now() - start.current.t);
    const velocity = Math.abs(dx) / dt; // px/ms
    start.current = null;
    if (Math.abs(dx) > THRESHOLD || (velocity > 0.6 && Math.abs(dx) > 30)) {
      decide(dx > 0 ? "like" : "pass");
    } else {
      setDrag({ x: 0, y: 0, active: false });
    }
  }

  let transform = `translate(${drag.x}px, ${drag.y * 0.15}px) rotate(${drag.x / 18}deg)`;
  if (leaving) transform = `translate(${leaving === "like" ? 140 : -140}%, ${drag.y * 0.15}px) rotate(${leaving === "like" ? 18 : -18}deg)`;
  const intent = leaving ?? (drag.x > 40 ? "like" : drag.x < -40 ? "pass" : null);
  const stampOpacity = leaving ? 1 : Math.min(1, Math.abs(drag.x) / THRESHOLD);

  return (
    <>
      <div className={s.stack}>
        {remaining > 2 && <div aria-hidden="true" className={s.layer2} />}
        {remaining > 1 && <div aria-hidden="true" className={s.layer1} />}
        <article
          key={card.recipe.id}
          className={[s.card, !drag.active && s.animate, !leaving && !drag.active && drag.x === 0 && s.enter].filter(Boolean).join(" ")}
          style={{ transform, opacity: leaving ? 0 : 1 }}
          aria-roledescription={tr("swipe.card")}
          aria-label={card.recipe.name}
          aria-describedby="kaydir-ipucu"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
            setDrag({ x: 0, y: 0, active: false });
          }}
        >
          <PhotoPlaceholder dish={card.recipe.name} height={300} style={{ padding: 14, flex: "none" }} />
          <div className={s.body}>
            <h2 className={s.name}>{card.recipe.name}</h2>
            <div className={s.facts}>
              <span className={s.fact}>
                <span className={s.factIcon}>
                  <IconClock size={17} />
                </span>
                {card.time}
              </span>
              <span className={s.fact}>
                <span className={s.factIcon}>
                  <IconHistory size={17} />
                </span>
                {card.last}
              </span>
            </div>
            {card.tags.length > 0 && (
              <div className={s.tags}>
                {card.tags.map((t) => (
                  <TagPill key={t}>{t}</TagPill>
                ))}
              </div>
            )}
          </div>
          {intent === "like" && (
            <span className={`${s.stamp} ${s.stampYes}`} style={{ opacity: stampOpacity }} aria-hidden="true">
              <IconHeart size={14} />
              {tr("swipe.like")}
            </span>
          )}
          {intent === "pass" && (
            <span className={`${s.stamp} ${s.stampNo}`} style={{ opacity: stampOpacity }} aria-hidden="true">
              {tr("swipe.pass")}
            </span>
          )}
        </article>
      </div>

      <div className={s.buttons}>
        <button type="button" className={s.pass} aria-label={tr("swipe.pass")} onClick={() => decide("pass")} disabled={disabled}>
          <IconClose size={26} />
        </button>
        <button type="button" className={s.like} aria-label={tr("swipe.like")} onClick={() => decide("like")} disabled={disabled}>
          <IconHeart size={32} />
        </button>
      </div>
      <p id="kaydir-ipucu" className={s.hint}>
        {tr("swipe.hint")}
      </p>
    </>
  );
}
