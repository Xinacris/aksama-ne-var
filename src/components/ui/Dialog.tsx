"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "../icons";
import s from "./Dialog.module.css";

/**
 * Native <dialog> (focus trap, Esc, backdrop) styled in the app's language.
 * Bottom sheet on phones, centered card on larger screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  /** Content with nothing to tap (a list to read): the scrolling body takes focus so keyboards can scroll it. */
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={s.inner}>
          <div className={s.head}>
            <div className={s.titles}>
              {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
              <h2 id="dialog-title" className={s.title}>
                {title}
              </h2>
            </div>
            <button type="button" className={s.close} onClick={onClose} aria-label="Kapat">
              <IconClose size={18} />
            </button>
          </div>
          <div className={s.body} tabIndex={readOnly ? 0 : undefined}>
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
