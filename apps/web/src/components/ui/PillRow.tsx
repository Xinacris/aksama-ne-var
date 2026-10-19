"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconCheck } from "@/components/icons";
import s from "./PillRow.module.css";

export interface PillOption {
  key: string;
  label: ReactNode;
  selected: boolean;
  onToggle: () => void;
}

/**
 * A row of toggle pills (filters). Wrap vs scroll is CSS only: with a mouse (hover + fine pointer)
 * the pills wrap; on touch they stay on one line and scroll sideways with snap. The only script is
 * the edge fade, shown on a side only while pills are hidden past it. The row is full-bleed inside
 * its column and pads itself with the page gutter (`--pill-gutter`, default 20px), so the first
 * pill lines up with the header at scroll 0.
 */
export function PillRow({ label, options, className }: { label: string; options: PillOption[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.dataset.fadeStart = String(max > 1 && el.scrollLeft > 1);
      el.dataset.fadeEnd = String(max > 1 && el.scrollLeft < max - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [options.length]);

  return (
    <div ref={ref} className={[s.row, className].filter(Boolean).join(" ")} role="group" aria-label={label} data-fade-start="false" data-fade-end="false">
      {options.map((o) => (
        <button key={o.key} type="button" className={s.pill} aria-pressed={o.selected} onClick={o.onToggle}>
          <span className={s.check} aria-hidden="true">
            <IconCheck size={16} strokeWidth={2.6} />
          </span>
          {o.label}
        </button>
      ))}
    </div>
  );
}
