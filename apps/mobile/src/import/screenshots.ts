import { requireOptionalNativeModule } from "expo";
import { launchImageLibraryAsync } from "expo-image-picker";
import { captionFromScreenshots } from "@anv/core/domain/import/screenshot";

/**
 * "Ekran görüntüsünden oku": the cook picks screenshots of a caption (several for a long one) and
 * the phone reads the text on the device: iOS Vision / Android ML Kit via expo-text-extractor.
 * Free, nothing is uploaded; only the text goes to the import, as if pasted. The module is looked
 * up optionally (the package's own import throws where it isn't built in: Expo Go).
 */
interface TextExtractor {
  isSupported: boolean;
  extractTextFromImage(path: string): Promise<string[]>;
}

export const MAX_SCREENSHOTS = 6;

function extractor(): TextExtractor | null {
  const m = requireOptionalNativeModule<TextExtractor>("ExpoTextExtractor");
  return m?.isSupported ? m : null;
}

export function screenshotReadingAvailable(): boolean {
  return extractor() !== null;
}

export type ScreenshotResult = { kind: "text"; text: string; count: number } | { kind: "cancelled" } | { kind: "empty" } | { kind: "unavailable" } | { kind: "failed" };

export async function readCaptionFromScreenshots(): Promise<ScreenshotResult> {
  const ocr = extractor();
  if (!ocr) return { kind: "unavailable" };
  // The system photo picker: no photo-library permission is needed to pick.
  const picked = await launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: MAX_SCREENSHOTS, orderedSelection: true, quality: 1 });
  if (picked.canceled || !picked.assets?.length) return { kind: "cancelled" };
  try {
    const pages: string[][] = [];
    for (const a of picked.assets) pages.push(await ocr.extractTextFromImage(a.uri.replace("file://", "")));
    const text = captionFromScreenshots(pages);
    return text ? { kind: "text", text, count: picked.assets.length } : { kind: "empty" };
  } catch {
    return { kind: "failed" };
  }
}
