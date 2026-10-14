import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import s from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "outlineInk" | "soft" | "ghost" | "link";
export type ButtonSize = "xl" | "lg" | "md" | "sm";

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  block?: boolean;
  className?: string;
  children: ReactNode;
}

export function buttonClass({ variant = "primary", size = "md", pill, block, className }: Omit<Common, "children">) {
  return [s.btn, s[variant], s[size], pill && s.pill, block && s.block, className].filter(Boolean).join(" ");
}

export function Button({
  variant,
  size,
  pill,
  block,
  className,
  type = "button",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass({ variant, size, pill, block, className })} {...rest} />;
}

export function ButtonLink({
  href,
  variant,
  size,
  pill,
  block,
  className,
  children,
  ...rest
}: Common & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass({ variant, size, pill, block, className })} {...rest}>
      {children}
    </Link>
  );
}
