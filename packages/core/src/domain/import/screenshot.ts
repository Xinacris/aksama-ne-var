/**
 * "Ekran görüntüsünden oku": text recognised on the phone from one or more screenshots of a post
 * (Instagram doesn't give the caption to anyone), turned into one caption for the usual parser.
 * Screenshots of a long caption overlap when the cook scrolls, so a line already taken from an
 * earlier screenshot is skipped. The app's own interface lines (likes, comments, "more",
 * translate, times) are dropped; anything else is kept, since the parser and the review form
 * handle the rest and a lost ingredient is worse than a stray line.
 */

const UI_LINES: RegExp[] = [
  /^(beğen|yorum yap|paylaş|kaydet|gönder|takip et|takiptesin|mesaj gönder|daha fazla|devamı|\.\.\. ?devamı|… ?devamı)$/,
  /^(like|comment|share|save|send|follow|following|message|more|\.\.\. ?more|… ?more)$/,
  /^(çeviriyi gör|see translation|view translation|çeviri)$/,
  /^(\d+[.,]?\d*\s*(b|bin|mn|k|m)?\s*(beğenme|beğeni|likes?|yorum|comments?|görüntülenme|views?))$/,
  /^(beğenenler|liked by)\b/,
  /^(\d+\s*yorumun tümünü gör|tüm \d+ yorumu gör|view all \d+ comments?)$/,
  /^(\d+\s*(sn|dk|sa|g|gün|hf|hafta|ay|yıl|s|m|h|d|w|y))( önce| ago)?$/,
  /^(ses|orijinal ses|original audio)\b/,
  /^[•·|]+$/,
];

const fold = (line: string) =>
  line
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ")
    .trim();

function isUiLine(line: string): boolean {
  const l = fold(line);
  if (!l || l.length < 2) return true;
  return UI_LINES.some((re) => re.test(l));
}

/** One caption from the text blocks of each screenshot, in the order they were picked. */
export function captionFromScreenshots(pages: string[][]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const blocks of pages) {
    for (const block of blocks) {
      for (const raw of block.split(/\r?\n/)) {
        const line = raw.replace(/\s+/g, " ").trim();
        if (isUiLine(line)) continue;
        const key = fold(line);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(line);
      }
    }
  }
  return out.join("\n").slice(0, 20_000);
}
