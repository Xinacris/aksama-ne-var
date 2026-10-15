import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { parseRecipeText } from "@anv/core/domain/import/parseText";
import ImportRecipe from "@/app/tarifler/ice-aktar";
import { freshStore, routerMock } from "./helpers";

// On-device OCR (expo-text-extractor's native module) and the system photo picker, faked.
const mockOcr: { isSupported: boolean; pages: string[][]; extractTextFromImage: jest.Mock<Promise<string[]>, [string]> } = {
  isSupported: true,
  pages: [],
  extractTextFromImage: jest.fn(async (_path: string): Promise<string[]> => mockOcr.pages.shift() ?? []),
};
jest.mock("expo", () => ({ ...jest.requireActual("expo"), requireOptionalNativeModule: jest.fn((name: string) => (name === "ExpoTextExtractor" ? mockOcr : null)) }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
const picker = () => jest.requireMock("expo-image-picker") as { launchImageLibraryAsync: jest.Mock };

const IG = "https://www.instagram.com/reel/C7xYz12AbCd/";
const PASTE_FIRST = {
  source: { platform: "instagram", url: IG, author: null, title: null, thumbnailUrl: null, needsPaste: true, hasText: false, availability: "public" },
  draft: null,
  path: null,
  provider: null,
  needsPaste: true,
  message: "Instagram, gönderinin açıklamasını dışarıya vermiyor.",
};
const DRAFT = {
  ...PASTE_FIRST,
  needsPaste: false,
  message: null,
  path: "rules",
  provider: "rules",
  draft: parseRecipeText(["Fırında köfte", "Malzemeler:", "500 gr kıyma", "1 soğan", "Yapılışı:", "Kıymayı yoğurun."].join("\n"), null),
};

let bodies: { url: string; text: string }[] = [];
beforeEach(() => {
  bodies = [];
  mockOcr.isSupported = true;
  mockOcr.pages = [];
  jest.clearAllMocks();
  global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { url: string; text: string };
    bodies.push(body);
    return new Response(JSON.stringify(body.text ? DRAFT : PASTE_FIRST), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
});

async function openInstagram() {
  await freshStore({ demo: true });
  routerMock().__params.current = { url: IG };
  await render(<ImportRecipe />);
  expect(await screen.findByText(/Instagram, gönderinin açıklamasını/)).toBeTruthy();
}

describe("Instagram: Ekran görüntüsünden oku", () => {
  it("reads two screenshots on the phone and imports the text like a pasted caption", async () => {
    await openInstagram();
    mockOcr.pages = [
      ["aysemutfakta", "Fırında köfte\nMalzemeler:\n500 gr kıyma", "Beğen"],
      ["500 gr kıyma\n1 soğan", "Kıymayı yoğurun.", "Çeviriyi gör"],
    ];
    picker().launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///a.png" }, { uri: "file:///b.png" }] });
    await fireEvent.press(screen.getByRole("button", { name: "Ekran görüntüsünden oku" }));
    expect(picker().launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, mediaTypes: ["images"] }));
    expect(mockOcr.extractTextFromImage).toHaveBeenCalledWith("/a.png");
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ url: IG, text: "aysemutfakta\nFırında köfte\nMalzemeler:\n500 gr kıyma\n1 soğan\nKıymayı yoğurun." });
    // on to the usual review form
    expect(await screen.findByDisplayValue("Fırında köfte")).toBeTruthy();
  }, 20000);

  it("no text found or cancelled: a calm line / nothing; the paste box stays", async () => {
    await openInstagram();
    picker().launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: null });
    await fireEvent.press(screen.getByRole("button", { name: "Ekran görüntüsünden oku" }));
    expect(bodies).toHaveLength(1);
    mockOcr.pages = [["Beğen", "3 g"]];
    picker().launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///c.png" }] });
    await fireEvent.press(screen.getByRole("button", { name: "Ekran görüntüsünden oku" }));
    expect(await screen.findByText(/Görüntülerde yazı bulamadık/)).toBeTruthy();
    expect(bodies).toHaveLength(1);
    expect(screen.getByLabelText("Açıklamayı buraya yapıştır")).toBeTruthy();
  }, 20000);

  it("isn't offered where the phone can't read images (Expo Go) — paste only", async () => {
    mockOcr.isSupported = false;
    await openInstagram();
    expect(screen.queryByRole("button", { name: "Ekran görüntüsünden oku" })).toBeNull();
  }, 20000);
});
