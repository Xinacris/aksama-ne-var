import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type ComponentPropsWithRef } from "react";
import s from "./Field.module.css";

interface FieldShell {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  icon?: ReactNode;
  trailing?: ReactNode;
  hideLabel?: boolean;
  className?: string;
}

export function TextField({
  label,
  hint,
  error,
  icon,
  trailing,
  hideLabel,
  className,
  id,
  ...input
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  return (
    <div className={[s.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={fid} className={hideLabel ? "visually-hidden" : s.label}>
        {label}
      </label>
      <div className={[s.box, error && s.invalid].filter(Boolean).join(" ")}>
        {icon && <span className={s.icon}>{icon}</span>}
        <input
          id={fid}
          className={s.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          {...input}
        />
        {trailing}
      </div>
      {hint && (
        <span id={hintId} className={s.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className={s.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  hideLabel,
  className,
  id,
  children,
  ...select
}: Omit<FieldShell, "icon" | "trailing" | "error"> & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={[s.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={fid} className={hideLabel ? "visually-hidden" : s.label}>
        {label}
      </label>
      <div className={s.box}>
        <select id={fid} className={`${s.input} ${s.select}`} {...select}>
          {children}
        </select>
      </div>
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  hideLabel,
  className,
  id,
  ...ta
}: Omit<FieldShell, "icon" | "trailing" | "error"> & ComponentPropsWithRef<"textarea">) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={[s.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={fid} className={hideLabel ? "visually-hidden" : s.label}>
        {label}
      </label>
      <div className={s.box} style={{ padding: 0 }}>
        <textarea id={fid} className={`${s.input} ${s.textarea}`} {...ta} />
      </div>
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}
