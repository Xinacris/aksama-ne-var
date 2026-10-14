import s from "./Avatar.module.css";

export interface AvatarPerson {
  id: string;
  name: string;
  initial: string;
  color: string;
}

const FONT: Record<number, number> = { 18: 9, 20: 10, 22: 11, 24: 11, 26: 12, 28: 12, 32: 13, 34: 14, 44: 17, 56: 22, 76: 30 };

export function Avatar({
  person,
  size = 34,
  ring = false,
  className,
  style,
  title,
}: {
  person: Pick<AvatarPerson, "initial" | "color" | "name">;
  size?: number;
  ring?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <span
      className={[s.avatar, ring && s.ring, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, background: person.color, fontSize: FONT[size] ?? Math.round(size * 0.4), ...style }}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      {person.initial}
    </span>
  );
}

/** Overlapping avatars with a bg-colored border, as in the header. */
export function AvatarStack({
  people,
  size = 34,
  overlap = 8,
  label,
  ringIds = [],
  borderColor,
}: {
  people: Pick<AvatarPerson, "id" | "initial" | "color" | "name">[];
  size?: number;
  overlap?: number;
  label?: string;
  ringIds?: string[];
  borderColor?: string;
}) {
  return (
    <span className={s.stack} role={label ? "img" : undefined} aria-label={label}>
      {people.map((p, i) => (
        <Avatar
          key={p.id}
          person={p}
          size={size}
          ring={ringIds.includes(p.id)}
          className={s.stacked}
          style={{ marginLeft: i === 0 ? 0 : -overlap, ...(borderColor ? { borderColor } : {}) }}
        />
      ))}
    </span>
  );
}

export function InviteAvatar({ size = 56, children }: { size?: number; children: React.ReactNode }) {
  return (
    <span className={s.dashed} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}
