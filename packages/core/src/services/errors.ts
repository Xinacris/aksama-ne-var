/** Expected, user-facing failures with calm Turkish copy. */
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
  return "Bir şeyler ters gitti. Bir daha deneyelim mi?";
}
