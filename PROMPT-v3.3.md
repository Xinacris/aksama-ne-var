# Round 3.3 — Fix: Turkish diacritics in iOS screenshot OCR

Pasted by the owner on 2026-10-15 ("PRISM KERNEL").

## Purpose
Screenshot text read on iOS can lose Turkish letters (ş→s, ı→i, ğ→g, ç→c, ö→o, ü→u). Imported Turkish recipes must keep correct spelling.

## Rules
- Keep OCR on-device and free; no new paid service.

## Interface
1. OCR config: if the text-recognition module allows it, set recognition languages to ["tr-TR", "en-US"] with language correction on (iOS Vision VNRecognizeTextRequest.recognitionLanguages / ML Kit Latin recognizer on Android). Check whether tr-TR is supported on the iOS versions we target; if the package doesn't expose the option, patch or extend it in the local module.
2. Parser safety net: when the import source is OCR, tell the AI parser (Gemini/Haiku) in the system prompt that the text may have stripped Turkish diacritics and must restore them in title, ingredients and steps. Recipe text only; don't rewrite quantities.
3. Rule-based parser (AI_PROVIDER=none): add a small dictionary-based restorer for common recipe words (kuşbaşı, soğan, şeker, yağ, çay kaşığı, yemek kaşığı, tuz, pişir, dakika, ılık, süt, etc.).

## Structure
- packages/shared/import/diacritics.ts (dictionary + restore function, unit-tested).
- Import pipeline passes `source: 'ocr'` to the parser.

## Motion
1. Try the OCR language config first.
2. Add the parser instruction + dictionary restorer.
3. Unit-test with fixtures: plain-ASCII Turkish caption → expected corrected text.

## KERNEL CHECK
- Key output: OCR-imported Turkish recipes have correct letters.
- Edge cases: words that are valid both ways (e.g. "sis"/"şiş", "kasık"/"kaşık"): restore by recipe context; leave ambiguous words untouched in the rule parser.
- Error states: if restoration is unsure, keep the original word; never invent text.
- Least surprise: the user still reviews the parsed recipe before saving.
