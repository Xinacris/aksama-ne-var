// One import per catalog file: Metro and Next can't glob at runtime. The list follows MATRIX
// (≤ 100 recipes per file, `src/recipes/files.ts` says which dish goes in which file).
import turkish_main_1 from "./turkish/main-1.json";
import turkish_main_2 from "./turkish/main-2.json";
import turkish_main_3 from "./turkish/main-3.json";
import turkish_main_4 from "./turkish/main-4.json";
import turkish_soup_1 from "./turkish/soup-1.json";
import turkish_soup_2 from "./turkish/soup-2.json";
import turkish_salad from "./turkish/salad.json";
import turkish_side from "./turkish/side.json";
import turkish_dessert from "./turkish/dessert.json";
import italian_main from "./italian/main.json";
import italian_soup from "./italian/soup.json";
import italian_salad from "./italian/salad.json";
import italian_side from "./italian/side.json";
import italian_dessert from "./italian/dessert.json";
import spanish_main from "./spanish/main.json";
import spanish_soup from "./spanish/soup.json";
import spanish_salad from "./spanish/salad.json";
import spanish_side from "./spanish/side.json";
import spanish_dessert from "./spanish/dessert.json";
import indian_main from "./indian/main.json";
import indian_soup from "./indian/soup.json";
import indian_side from "./indian/side.json";
import indian_dessert from "./indian/dessert.json";
import american_main from "./american/main.json";
import american_soup from "./american/soup.json";
import american_salad from "./american/salad.json";
import american_side from "./american/side.json";
import american_dessert from "./american/dessert.json";
import french_main from "./french/main.json";
import french_soup from "./french/soup.json";
import french_salad from "./french/salad.json";
import french_side from "./french/side.json";
import french_dessert from "./french/dessert.json";
import indonesian_main from "./indonesian/main.json";
import indonesian_soup from "./indonesian/soup.json";
import indonesian_salad from "./indonesian/salad.json";
import british_main from "./british/main.json";
import british_side from "./british/side.json";
import british_dessert from "./british/dessert.json";

/** Catalog files by path (cuisine/category[-n].json), in dish-list order. */
export const CATALOG_FILES: Record<string, unknown[]> = {
  "turkish/main-1.json": turkish_main_1,
  "turkish/main-2.json": turkish_main_2,
  "turkish/main-3.json": turkish_main_3,
  "turkish/main-4.json": turkish_main_4,
  "turkish/soup-1.json": turkish_soup_1,
  "turkish/soup-2.json": turkish_soup_2,
  "turkish/salad.json": turkish_salad,
  "turkish/side.json": turkish_side,
  "turkish/dessert.json": turkish_dessert,
  "italian/main.json": italian_main,
  "italian/soup.json": italian_soup,
  "italian/salad.json": italian_salad,
  "italian/side.json": italian_side,
  "italian/dessert.json": italian_dessert,
  "spanish/main.json": spanish_main,
  "spanish/soup.json": spanish_soup,
  "spanish/salad.json": spanish_salad,
  "spanish/side.json": spanish_side,
  "spanish/dessert.json": spanish_dessert,
  "indian/main.json": indian_main,
  "indian/soup.json": indian_soup,
  "indian/side.json": indian_side,
  "indian/dessert.json": indian_dessert,
  "american/main.json": american_main,
  "american/soup.json": american_soup,
  "american/salad.json": american_salad,
  "american/side.json": american_side,
  "american/dessert.json": american_dessert,
  "french/main.json": french_main,
  "french/soup.json": french_soup,
  "french/salad.json": french_salad,
  "french/side.json": french_side,
  "french/dessert.json": french_dessert,
  "indonesian/main.json": indonesian_main,
  "indonesian/soup.json": indonesian_soup,
  "indonesian/salad.json": indonesian_salad,
  "british/main.json": british_main,
  "british/side.json": british_side,
  "british/dessert.json": british_dessert,
};
