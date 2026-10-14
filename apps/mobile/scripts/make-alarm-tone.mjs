// Writes the original timer alarm tone (assets/sounds/timer_alarm.wav) from the pattern in
// packages/core/src/domain/alarmTone.ts — the same beeps the web plays with Web Audio.
// Synthesized here (sine + a little third harmonic, soft attack/release); no third-party audio.
// Run: node scripts/make-alarm-tone.mjs   (Node 24 loads the .ts file directly)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { ALARM_TONE } = await import(join(here, "../../../packages/core/src/domain/alarmTone.ts"));

const RATE = 22050;
const LOOPS = 3; // ~4 s: long enough for a notification sound; the app loops it while ringing
const FADE = 0.008; // s

const samples = [];
for (let loop = 0; loop < LOOPS; loop++) {
  for (const { freq, ms } of ALARM_TONE) {
    const n = Math.round((RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      if (!freq) {
        samples.push(0);
        continue;
      }
      const t = i / RATE;
      const env = Math.min(1, t / FADE, (n - i) / RATE / FADE);
      const v = Math.sin(2 * Math.PI * freq * t) * 0.85 + Math.sin(2 * Math.PI * freq * 3 * t) * 0.15;
      samples.push(v * env * 0.8);
    }
  }
}

const data = Buffer.alloc(samples.length * 2);
samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const out = join(here, "../assets/sounds/timer_alarm.wav");
writeFileSync(out, Buffer.concat([header, data]));
console.log(`${out}: ${(samples.length / RATE).toFixed(2)} s, ${((44 + data.length) / 1024).toFixed(0)} KB`);
