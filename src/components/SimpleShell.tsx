import Link from "next/link";
import type { ReactNode } from "react";
import s from "./SimpleShell.module.css";

/** Web header from the onboarding screens: serif brand left, quiet note right. */
export function SimpleShell({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link href="/" className={s.brand}>
          Akşama ne var?
        </Link>
        {aside && <span className={s.aside}>{aside}</span>}
      </header>
      {children}
    </div>
  );
}

export const shell = s;
