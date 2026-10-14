import type { EnRecipe } from "./types";

/** Sides: pilafs, börek, potatoes. A "cup" is the Turkish su bardağı (200 ml). */
export const yanindaEn: Record<string, EnRecipe> = {
  "tereyagli-pirinc-pilavi": {
    name: "Tereyağlı pirinç pilavı (buttered rice pilaf)",
    shortName: "Rice pilaf",
    prep: ["Soak the rice in warm salted water"],
    steps: [
      "Rinse the soaked rice until the water runs clear, then drain.",
      "Melt the butter and fry the rice for 3–4 minutes, until translucent.",
      "Add 3 cups of boiling water and the salt.",
      "When it boils, cook over low heat for 15 minutes until the water is absorbed.",
      "Put a paper towel under the lid and let it steam for 10 minutes.",
    ],
  },
  "bulgur-pilavi": {
    name: "Bulgur pilavı (bulgur pilaf)",
    shortName: "Bulgur pilaf",
    steps: [
      "Soften the onion and pepper in butter.",
      "Add the tomato paste and grated tomato and cook for a few minutes.",
      "Stir in the bulgur, then add 3 cups of hot water and the salt.",
      "Cook over low heat for 15 minutes until the water is absorbed, then rest for 10 minutes.",
    ],
  },
  "sehriyeli-pilav": {
    name: "Şehriyeli pilav (rice with orzo)",
    shortName: "Rice with orzo",
    prep: ["Soak the rice in warm salted water"],
    steps: [
      "Toast the orzo in butter until golden.",
      "Add the drained rice and fry for 2 more minutes.",
      "Add 3 cups of boiling water and the salt.",
      "Cook over low heat until the water is absorbed, then let it steam for 10 minutes.",
    ],
  },
  makarna: {
    name: "Makarna (buttered pasta)",
    shortName: "Pasta",
    notes: { "Beyaz peynir": "to serve" },
    steps: [
      "Bring plenty of water to the boil and salt it.",
      "Add the pasta and cook for the time on the packet, stirring now and then.",
      "Drain and toss with butter while hot.",
      "Serve with crumbled white cheese.",
    ],
  },
  "patates-kizartmasi": {
    name: "Patates kızartması (chips)",
    shortName: "Chips",
    steps: [
      "Cut the potatoes into fingers, soak them in cold water for 15 minutes and pat dry.",
      "Heat the oil over medium heat and fry the potatoes until soft, then lift them out.",
      "Get the oil really hot and fry them a second time until crisp.",
      "Drain on paper towels, salt and serve hot.",
    ],
  },
  "nohutlu-pilav": {
    name: "Nohutlu pilav (rice with chickpeas)",
    shortName: "Chickpea rice",
    prep: ["Soak the rice in warm salted water"],
    steps: [
      "Fry the drained rice in butter.",
      "Add the chickpeas and stir for a minute.",
      "Add 3 cups of boiling water and the salt.",
      "Cook until the water is absorbed, let it steam and serve.",
    ],
  },
  "ic-pilav": {
    name: "İç pilav (spiced rice with pine nuts and currants)",
    shortName: "İç pilav",
    prep: ["Soak the rice in warm salted water"],
    steps: [
      "Toast the pine nuts in butter until golden.",
      "Add the finely chopped onion; when soft, add the rice and fry it.",
      "Add the currants, spices, salt and 3 cups of hot water.",
      "Cook until the water is absorbed, sprinkle with dill and let it steam.",
    ],
  },
  "sebzeli-bulgur-pilavi": {
    name: "Sebzeli bulgur pilavı (bulgur pilaf with vegetables)",
    shortName: "Vegetable bulgur",
    steps: [
      "Finely chop the onion, carrot and pepper and sauté them in butter.",
      "Stir in the peas and bulgur.",
      "Add 3 cups of hot water and the salt.",
      "Cook over low heat until the water is absorbed, then let it rest.",
    ],
  },
  "su-boregi": {
    name: "Su böreği (boiled-pastry cheese börek)",
    shortName: "Su böreği",
    steps: [
      "Cut the yufka sheets to the size of the tray and boil them one by one in salted water, then plunge into cold water.",
      "Whisk the eggs, milk and half the melted butter.",
      "Layer the sheets in the tray, brushing each with the mixture; spread the cheese and parsley filling in the middle.",
      "Cover with the remaining sheets, brushing them too.",
      "Bake at 180°C for 40 minutes until golden.",
    ],
  },
  "sigara-boregi": {
    name: "Sigara böreği (cheese pastry rolls)",
    shortName: "Sigara böreği",
    steps: [
      "Mash the cheese and mix it with finely chopped parsley.",
      "Cut the yufka into triangles.",
      "Put filling on the wide edge, fold in the sides and roll tightly; seal the tip with egg.",
      "Fry in hot oil until golden all over.",
    ],
  },
  "patatesli-rulo-borek": {
    name: "Patatesli rulo börek (potato börek rolls)",
    shortName: "Potato börek",
    steps: [
      "Boil and mash the potatoes; mix with fried onion and the spices.",
      "Whisk the egg, milk and oil.",
      "Lay out a yufka, brush with the mixture, put the potato filling along the edge and roll it up.",
      "Arrange the rolls in a tray and brush over the rest of the mixture.",
      "Bake at 180°C for 35 minutes.",
    ],
  },
  "ispanakli-borek": {
    name: "Ispanaklı börek (spinach börek)",
    shortName: "Spinach börek",
    steps: [
      "Wash and chop the spinach, cook it with the onion until wilted and let it cool.",
      "Add the cheese to make the filling.",
      "Whisk the egg, yoghurt and oil.",
      "Brush the yufka with the mixture and fold it into the tray in layers, spreading filling in between.",
      "Bake at 180°C for 40 minutes.",
    ],
  },
  "patates-puresi": {
    name: "Patates püresi (mashed potatoes)",
    shortName: "Mash",
    steps: [
      "Peel the potatoes, cut them into chunks and boil in salted water until soft.",
      "Drain and mash while hot.",
      "Beat in the warm milk and butter until smooth.",
      "Season with salt and pepper.",
    ],
  },
  eriste: {
    name: "Erişte (egg noodles with walnuts)",
    shortName: "Erişte",
    steps: [
      "Boil the erişte in salted water for 10 minutes until soft, then drain.",
      "Toast the walnuts lightly in butter.",
      "Add the erişte and toss.",
      "Check the salt and serve hot.",
    ],
  },
  "firinda-baharatli-patates": {
    name: "Fırında baharatlı patates (spiced roast potatoes)",
    shortName: "Roast potatoes",
    steps: [
      "Cut the unpeeled potatoes into wedges, wash and pat dry.",
      "Toss with olive oil, crushed garlic and the spices.",
      "Spread them in a single layer on a tray.",
      "Roast at 220°C for 35 minutes, turning halfway.",
    ],
  },
};
