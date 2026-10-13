import { findDurations } from "../durations";

/**
 * Pişirme is time on heat or in the oven only. Marinating, resting, soaking,
 * chilling and rising are waiting ("Bekleme"), and overnight soaks are
 * prep-ahead notes, not minutes.
 */

const WAIT = /marine|dinlendir|dinlensin|dinlenme|bekle|ıslat|buzdolabında|dolapta|soğut|soğumaya|mayalan|kabarsın|kabarmaya|demlen|rest|chill|soak/u;
const HEAT = /pişir|kaynat|kızart|fırın|haşla|kavur|sotele|ocak|ateş|közle|ızgara|tava(?!k)|buğula|bake|fry|boil|simmer|roast/u;
const OVERNIGHT = /akşamdan|gece boyunca|bir gece|overnight/u;

const low = (s: string) => s.toLocaleLowerCase("tr");

/** A step that only waits ("Hamuru 30 dakika dinlendirin"); mixed steps count as cooking. */
export function isWaitingStep(text: string): boolean {
  const t = low(text);
  return WAIT.test(t) && !HEAT.test(t);
}

/** Minutes of heat vs waiting in the steps; overnight waits are left to the prep notes. */
export function stepMinutes(steps: { text: string; minutes: number | null }[]): { heat: number; wait: number } {
  let heat = 0;
  let wait = 0;
  for (const s of steps) {
    if (!s.minutes) continue;
    if (!isWaitingStep(s.text)) heat += s.minutes;
    else if (!OVERNIGHT.test(low(s.text))) wait += s.minutes;
  }
  return { heat, wait };
}

/** A step that really keeps something on heat for an hour or more ("kısık ateşte 2 saat pişirin"). */
function longHeat(text: string): boolean {
  const t = low(text);
  if (!HEAT.test(t) || isWaitingStep(text)) return false;
  return findDurations(text).some((d) => d.seconds >= 60 * 60) || /saatlerce|\d+\s*saat|bir saat|iki saat/u.test(t);
}

/** Pişirme over 90 min with no step that simmers or roasts that long: probably waiting counted as cooking. */
export function cookTimeLooksLong(cookMinutes: number, steps: string[]): boolean {
  return cookMinutes > 90 && !steps.some(longHeat);
}
