import type { EnRecipe } from "./types";

/** Soups. A "cup" is the Turkish su bardağı (200 ml). */
export const corbaEn: Record<string, EnRecipe> = {
  "mercimek-corbasi": {
    name: "Mercimek çorbası (red lentil soup)",
    shortName: "Lentil soup",
    notes: { Limon: "to serve" },
    steps: [
      "Rinse the lentils in a sieve until the water runs clear.",
      "Roughly chop the onion, carrot and potato; soften the onion in butter for a few minutes.",
      "Stir in the flour until it smells toasty, then add the vegetables and lentils.",
      "Cover with hot water by two fingers (about 7 cups) and cook for 20 minutes, until the lentils fall apart.",
      "Blend, loosen with hot water if needed, and season with salt.",
      "Drizzle with chilli-flake butter and serve with cumin and lemon.",
    ],
  },
  "ezogelin-corbasi": {
    name: "Ezogelin çorbası (lentil and bulgur soup)",
    shortName: "Ezogelin",
    notes: { Limon: "to serve" },
    steps: [
      "Rinse the lentils, bulgur and rice together.",
      "Soften the finely chopped onion in butter, add the pastes and fry for a minute.",
      "Add the pulses and 7 cups of hot water.",
      "Cook over low heat for 30 minutes, stirring now and then; the lentils should break down and the bulgur stay whole.",
      "Season with salt and stir in the mint and chilli flakes just before taking it off the heat.",
      "Serve hot with lemon.",
    ],
  },
  "tarhana-corbasi": {
    name: "Tarhana çorbası (tarhana soup)",
    shortName: "Tarhana",
    steps: [
      "Soak the tarhana in a cup of lukewarm water for 10 minutes.",
      "Fry the grated garlic and tomato paste together in butter.",
      "Add 5 cups of hot water; when it boils, whisk in the tarhana.",
      "Cook for 10 minutes, stirring all the time so it doesn’t go lumpy.",
      "Season with salt and dried mint and serve.",
    ],
  },
  "yayla-corbasi": {
    name: "Yayla çorbası (yoghurt and rice soup)",
    shortName: "Yayla soup",
    notes: { Yumurta: "yolk" },
    steps: [
      "Rinse the rice and simmer it in 5 cups of water for 15 minutes, until soft.",
      "In a bowl, whisk the yoghurt, egg yolk and flour until smooth.",
      "Temper the yoghurt by whisking in a few ladles of the rice water, a little at a time.",
      "Pour it into the pot and bring to the boil, stirring in one direction so it doesn’t split.",
      "Sizzle the mint briefly in butter and drizzle it over the soup.",
    ],
  },
  "domates-corbasi": {
    name: "Domates çorbası (tomato soup)",
    shortName: "Tomato soup",
    notes: { "Kaşar peyniri": "grated, to serve" },
    steps: [
      "Grate the tomatoes and discard the skins.",
      "Toast the flour in butter until lightly coloured, then add the tomato paste.",
      "Add the grated tomatoes, cook for 5 minutes, then pour in 4 cups of hot water.",
      "Simmer for 15 minutes, add the milk gradually and bring back to a simmer.",
      "Season with salt and pepper and serve with the kaşar.",
    ],
  },
  "tavuk-suyu-corba": {
    name: "Tavuk suyu çorba (chicken soup)",
    shortName: "Chicken soup",
    notes: { Yumurta: "for the egg-lemon finish" },
    steps: [
      "Simmer the chicken in 7 cups of water for 25 minutes, skimming the foam; lift it out and shred it.",
      "Strain the stock back into the pot and add the diced carrot.",
      "Toast the vermicelli lightly in butter, add it to the stock and cook for 10 minutes.",
      "Whisk the egg with the lemon juice, temper with a ladle of soup and pour it into the pot.",
      "Add the shredded chicken, bring back to a simmer and serve with salt and pepper.",
    ],
  },
  "sehriye-corbasi": {
    name: "Şehriye çorbası (vermicelli soup)",
    shortName: "Vermicelli soup",
    steps: [
      "Cook the grated tomato and tomato paste in butter for a few minutes.",
      "Add 5 cups of hot water and bring to the boil.",
      "Add the vermicelli and cook for 8–10 minutes, until soft.",
      "Season with salt and mint and serve with a squeeze of lemon.",
    ],
  },
  "dugun-corbasi": {
    name: "Düğün çorbası (wedding soup)",
    shortName: "Wedding soup",
    notes: { Yumurta: "yolk" },
    steps: [
      "Simmer the meat in 6 cups of water, skimming the foam, for about 50 minutes until tender.",
      "Lift out the meat, shred it and strain the stock.",
      "Whisk the yoghurt, flour, egg yolk and lemon juice; temper with some of the hot stock.",
      "Pour it into the pot, bring to the boil while stirring and return the meat.",
      "Sizzle paprika in butter and drizzle it over the top.",
    ],
  },
  "sebze-corbasi": {
    name: "Sebze çorbası (vegetable soup)",
    shortName: "Vegetable soup",
    steps: [
      "Dice all the vegetables small.",
      "Soften the onion in butter, add the other vegetables and cook for 5 minutes.",
      "Add 5 cups of hot water and cook for 20 minutes, until the vegetables are soft.",
      "If you like, blend half and stir it back in; loosen with milk.",
      "Season with salt and pepper and serve.",
    ],
  },
  "mantar-corbasi": {
    name: "Mantar çorbası (mushroom soup)",
    shortName: "Mushroom soup",
    steps: [
      "Wipe and thinly slice the mushrooms; finely chop the onion.",
      "Soften the onion in butter and sauté the mushrooms until their liquid has gone.",
      "Add the flour, cook for a minute, then whisk in 3 cups of hot water.",
      "Cook for 10 minutes, add the milk and bring back to a simmer.",
      "Stir in the cream, take it off the heat and serve with salt and pepper.",
    ],
  },
  "yesil-mercimek-corbasi": {
    name: "Yeşil mercimek çorbası (green lentil soup)",
    shortName: "Green lentil soup",
    notes: { Limon: "to serve" },
    steps: [
      "Rinse the lentils and simmer them in 6 cups of water for 25 minutes.",
      "In a separate pan, sauté the onion and carrot in butter and add the tomato paste.",
      "Add the vegetables to the lentils and cook for 15 more minutes.",
      "Mash half if you like; season with salt and cumin.",
      "Serve with lemon.",
    ],
  },
  "toyga-corbasi": {
    name: "Toyga çorbası (yoghurt soup with chickpeas)",
    shortName: "Toyga soup",
    notes: { Yumurta: "yolk" },
    steps: [
      "Simmer the bulgur in 5 cups of water for 15 minutes, then add the chickpeas.",
      "Whisk the yoghurt, flour and egg yolk; temper with some of the hot liquid.",
      "Pour it into the pot and bring to the boil, stirring all the time.",
      "Sizzle the mint in butter and drizzle it over the top.",
    ],
  },
  "patates-corbasi": {
    name: "Patates çorbası (potato soup)",
    shortName: "Potato soup",
    notes: { "Kaşar peyniri": "to serve" },
    steps: [
      "Chop the potatoes, onion and carrot and cook them in butter for 5 minutes.",
      "Add 4 cups of hot water and cook until the potatoes fall apart.",
      "Blend and loosen with milk.",
      "Season with salt and pepper and serve with grated kaşar.",
    ],
  },
  "brokoli-corbasi": {
    name: "Brokoli çorbası (broccoli soup)",
    shortName: "Broccoli soup",
    steps: [
      "Cut the broccoli into small florets; chop the potato and onion.",
      "Soften the onion in butter, then add the potato and broccoli.",
      "Cook in 4 cups of hot water until the vegetables are soft.",
      "Blend, stir in the cream, bring back to a simmer and season.",
    ],
  },
  "kabak-corbasi": {
    name: "Kabak çorbası (courgette soup)",
    shortName: "Courgette soup",
    prep: ["Wash and chop the courgettes"],
    steps: [
      "Chop the courgettes, potato, onion and garlic.",
      "Soften the onion and garlic in olive oil, then add the other vegetables.",
      "Cook in 4 cups of hot water until the vegetables are soft.",
      "Blend, add the milk and warm through; serve with mint and salt.",
    ],
  },
};
