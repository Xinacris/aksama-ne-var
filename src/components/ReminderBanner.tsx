import { IconCheck, IconSnowflake } from "./icons";
import { Avatar, type AvatarPerson } from "./ui/Avatar";
import s from "./ReminderBanner.module.css";

export interface ReminderProps {
  text: string;
  meta: string;
  done: boolean;
  doneBy?: Pick<AvatarPerson, "name" | "initial" | "color"> | null;
  doneAt?: string;
  actionLabel?: string;
  onDone?: () => void;
  onUndo?: () => void;
}

/** "Günün hatırlatması" banner from Main.dc.html (Bekliyor ↔ tamamladı · HH:MM, undo). */
export function ReminderBanner({ text, meta, done, doneBy, doneAt, actionLabel = "Yaptım", onDone, onUndo }: ReminderProps) {
  return (
    <section aria-label="Günün hatırlatması" className={`${s.banner} ${done ? s.done : s.pending}`}>
      <div className={s.top}>
        <span className={s.icon}>
          <IconSnowflake size={22} />
        </span>
        <div className={s.texts}>
          <p className={s.text}>{text}</p>
          <span className={s.meta}>{meta}</span>
        </div>
      </div>
      <div className={s.row} role="status">
        {done ? (
          <>
            <span className={s.doneBy}>
              {doneBy && <Avatar person={doneBy} size={24} />}
              {doneBy ? `${doneBy.name} tamamladı` : "Tamamlandı"}
              {doneAt ? ` · ${doneAt}` : ""}
            </span>
            {onUndo && (
              <button type="button" className={s.undo} onClick={onUndo}>
                Geri al
              </button>
            )}
          </>
        ) : (
          <>
            <span className={s.waiting}>
              <span className={s.ring} />
              Bekliyor
            </span>
            {onDone && (
              <button type="button" className={s.action} onClick={onDone}>
                <IconCheck size={18} />
                {actionLabel}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Compact variant from Componentler: "Bekliyor · Ali" / "Ali tamamladı · 09:12". */
export function ReminderChip({ title, status, done }: { title: string; status: string; done: boolean }) {
  return (
    <div className={`${s.compact} ${done ? s.done : s.pending}`}>
      <span className={s.icon}>{done ? <IconCheck size={20} /> : <IconSnowflake size={20} />}</span>
      <span className={s.compactTexts}>
        <span className={s.compactTitle}>{title}</span>
        <span className={s.compactStatus}>{status}</span>
      </span>
    </div>
  );
}
