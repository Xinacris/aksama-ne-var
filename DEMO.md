# 5-minute demo (on https://aksama-ne-var.vercel.app)

Use a desktop browser for the board; a phone (or devtools at 390 px) for the mobile screens.

**1. The sample household (1 min)**
- Open the site → **Örnek evle dene · Ali ve Zeynep**. You are Ali.
- **Bugün**: date header, the morning reminder ("Akşama İzmir köfte var, kıymayı buzluktan
  çıkarmayı unutma.") — tap **Çıkardım**, see "Ali tamamladı · HH:MM", then **Geri al**.
  Zeynep's line, tonight's menu ("İkiniz de onayladınız"), yesterday's kuru fasulye leftover,
  and tomorrow's karnıyarık.
- Tap **Menüyü ve ön hazırlığı aç**: menu parts, prep timeline, ingredient statuses
  (tap "Listede" → "Evde var"), servings scaler, steps, **Menüyü pişirmeye başla** (cooking mode,
  see Round 2).

**2. The week (1 min)** — **Hafta**
- Saturday "Dışarıda yendi", Sunday/Tuesday leftovers linked into the next day's lunch,
  freezer items, summary bar.
- Drag **Mantı** from "Eşleşmelerden" onto Friday's **Ana**. Drag a planned tile to another day
  (it swaps if occupied). Keyboard: focus a tile, Space, arrows, Space.
- Click a day header → "Artarsa" choices (Tarifteki gibi / Ertesi gün öğlen / Dolaba kalır / Artmaz),
  "Dışarıda yedik". Use ‹ › and **Bugün** to move weeks.

**3. Swiping together (1.5 min)**
- **Eşleş**: "Zeynep 12 kartın 8'ini kaydırdı · seçimleri gizli". Press **→** (or Olur) on the
  first card — Zeynep already liked it, so the match moment appears → **Cuma akşamına koy**.
- For a live two-person run: open a **second tab** at `/giris?cikis=1` (logs out only that tab),
  log in as `zeynep@demo.ev` / `demo1234`. Now the tabs are two people. Open Eşleş in both
  (same day via the "… için ana yemek" picker) and like the same card — the moment shows in both.

**4. Shopping live (1 min)** — **Liste** in both tabs
- Market tab: Kasap / Süt ve kahvaltılık / Bakliyat… with "x/y" counts; each row says which dish
  it's for. Check an item in one tab → the other highlights "Ali aldı · az önce" instantly.
- **Alışverişi bitir**: bought items move to "evde var" and leave the list; the rest stay.

**5. Changes, recipes, settings (30 s)**
- Bugün → **Plan değişti** → "Yarınla yer değiştir", or **Bugün dışarıda yedik** (neutral card,
  dish goes back to matches, ingredients stay on the list).
- **Tarifler**: search "imam", filter by course/tag, **Yeni tarif**.
- **Ayarlar**: theme (Açık/Koyu/Sistem), invite link + WhatsApp, export JSON, reset.

To start fresh: Ayarlar › **Tüm verileri sıfırla**, then **Hesap oluştur** to see onboarding.

---

# Round 2 (about 4 minutes)

No setup needed: the import works without keys (rule-based reading). With `ANTHROPIC_API_KEY`
set in Vercel the same flow uses Claude and the review note says so.

**A. Import with the paste fallback (1.5 min)** — **Tarifler › Linkten ekle**
- Paste an Instagram Reel link (any `instagram.com/reel/…`) → **Taslağı çıkar**. A link card
  appears with a kind note: Instagram doesn't share captions, so the paste box opens and gets focus.
- Paste a caption, for example:
  ```
  Fırında Patatesli Köfte 😍
  500 gr kıyma
  2 dilim bayat ekmek içi
  1 adet soğan
  4 adet patates
  Tuz, karabiber, kimyon
  1️⃣ Kıymayı soğan ve ekmekle yoğurun.
  2️⃣ Patatesleri dilimleyip tepsiye dizin.
  3️⃣ 200 derece fırında 35-40 dakika pişirin.
  ```
  → **Taslağı çıkar**. The draft opens in the normal recipe form (catalog names, pazar/market,
  "Kontrol edip kaydet"). Save → the recipe page credits the source ("Kaynak: … · Instagram").
- A TikTok or YouTube link fetches the caption/title through their public oEmbed; a recipe site
  with schema.org data fills everything without pasting. **Ayarlar › Linkten tarif** shows
  "Bu ay N tarif içe aktarıldı".
- On Android, "Ana ekrana ekle" then share a Reel → the app opens on the import screen.

**B. Leftovers are a choice (1 min)** — **Bugün**
- "Dünkü kuru fasulye bugün öğlen için yeterli." now has one-tap choices: **Hiç kalmadı ·
  Bugün öğlen · Dolaba kaldır · Kimse yemeyecek**. Tap **Dolaba kaldır** → "dolapta ·
  Çarşamba'ya kadar · Ali seçti", **Geri al** undoes it. The second tab (Zeynep) updates live and
  the activity feed records it neutrally.
- **Dolapta**: Friday's etli biber dolması "Bugüne kadar" → **Akşama koy** (or on Hafta, drag it
  from the "Dolapta" panel onto an evening). It shows as "Dolaptan" and adds nothing to the list.
- **Ayarlar › Öğlenleri evde yiyen var mı?** → **Hayır**: yesterday's lunch becomes a dolapta
  item and "öğlen" is no longer offered. Recipe form: **Artarsa ne olur?** (Artmaz / Ertesi gün
  öğlen yenir / Saklanır, X gün).

**C. Cooking mode with two timers (1.5 min)** — Bugün › tonight's card › **Pişirmeye başla**
- **Hazırlık**: pending prep on top ("Kıymayı buzluktan çıkar · Çıkardım"), all ingredients of
  the menu merged — tap to tick. **Pişirmeye başla**.
- One step per screen, big text; **Sonraki/Önceki**, swipe, or ←/→. Tabs: Mercimek · İzmir köfte ·
  Pirinç pilavı · Çoban salata — each keeps its own step.
- Mercimek step 4 → **Zamanlayıcı başlat · 20 dk**; switch to İzmir köfte step 1 →
  **Zamanlayıcı başlat · 20 dk** a bit later. Both run in the sticky bar while you move around;
  reload the page — they keep counting. When one ends: banner + sound + vibration (phones).
- Zeynep's tab shows "Ali pişiriyor · adım 4/20" on Bugün.
- Finish the steps → **Bitti** → **Afiyet olsun**: tonight is marked cooked; the leftover question
  is pre-selected from the recipe ("Dolaba kaldır" for köfte) — pick one; add "salça" under
  "Eksik çıkan bir şey oldu mu?" and it lands on the list.
