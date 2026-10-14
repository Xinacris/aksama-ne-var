import { t } from "../i18n";

/** Expected, user-facing failures with calm copy (from the catalog, in the current language). */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function messageOf(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return t("errors.generic");
}
