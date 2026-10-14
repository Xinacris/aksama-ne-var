"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import s from "./ChoiceChips.module.css";

/**
 * Pick one of a few options as chips side by side (wrapping on narrow
 * screens). A radio group: one tab stop, arrow keys move and select,
 * Space/Enter select — like native radios.
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  function onKey(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : step ? (i + step + options.length) % options.length : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(options[to].value);
    refs.current[to]?.focus();
  }

  return (
    <div className={s.field}>
      <span id={labelId} className={s.label}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className={s.chips}>
        {options.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={i === current}
            tabIndex={i === current ? 0 : -1}
            className={s.chip}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
