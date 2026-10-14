import type { EnRecipe } from "./types";

/** Breakfast/one-plate and desserts. A "cup" is the Turkish su bardağı (200 ml). */
export const kahvaltiTatliEn: Record<string, EnRecipe> = {
  menemen: {
    name: "Menemen (eggs with tomatoes and peppers)",
    shortName: "Menemen",
    steps: [
      "Finely chop the peppers and cook them in butter until soft.",
      "Add the peeled, chopped tomatoes and cook until some of the juice has gone.",
      "Crack in the eggs and add salt and chilli flakes.",
      "Stir gently until the eggs are as you like them and serve hot.",
    ],
  },
  "sucuklu-yumurta": {
    name: "Sucuklu yumurta (eggs with sucuk)",
    shortName: "Eggs with sucuk",
    steps: [
      "Thinly slice the sucuk and turn both sides in a dry pan.",
      "When the sucuk has released its fat, crack the eggs in between.",
      "Cover and cook over low heat until the whites are set.",
      "Sprinkle with chilli flakes and serve in the pan.",
    ],
  },
  cilbir: {
    name: "Çılbır (poached eggs on garlic yoghurt)",
    shortName: "Çılbır",
    steps: [
      "Whisk the yoghurt with crushed garlic and salt and spread it on plates.",
      "Keep vinegared water just below the boil and poach the eggs one at a time for 3 minutes.",
      "Lift the eggs out with a slotted spoon onto the yoghurt.",
      "Foam chilli flakes in butter and drizzle it over.",
    ],
  },
  gozleme: {
    name: "Gözleme (stuffed flatbread)",
    shortName: "Gözleme",
    steps: [
      "Finely chop the spinach and mix it with the crumbled cheese.",
      "Cut the yufka in half into half-moons.",
      "Put filling on one half and fold, sealing the edges.",
      "Cook both sides in a wide pan, brushing with butter.",
    ],
  },
  "patatesli-yumurta": {
    name: "Patatesli yumurta (eggs with potatoes)",
    shortName: "Eggs with potatoes",
    steps: [
      "Dice the potatoes small and cook them in oil, covered, until soft.",
      "Add the chopped onion and fry uncovered for a few minutes.",
      "Crack in the eggs and stir gently.",
      "When the eggs are cooked, serve with salt and chilli flakes.",
    ],
  },
  mihlama: {
    name: "Mıhlama (cheese and cornmeal fondue)",
    shortName: "Mıhlama",
    steps: [
      "Melt the butter in a pan, add the cornmeal and toast until fragrant.",
      "Whisk in a cup of hot water and stir until thick.",
      "Add the grated kaşar and let it melt, without stirring, until stretchy.",
      "Serve hot in the pan.",
    ],
  },
  "kiymali-yumurta": {
    name: "Kıymalı yumurta (eggs with mince)",
    shortName: "Eggs with mince",
    steps: [
      "Fry the onion in a little oil, add the mince and cook until its liquid has gone.",
      "Add the chopped tomato and cook for a few minutes.",
      "Crack the eggs on top, cover and wait until the whites are set.",
      "Sprinkle with chilli flakes and serve.",
    ],
  },
  "ispanakli-yumurta": {
    name: "Ispanaklı yumurta (eggs with spinach)",
    shortName: "Eggs with spinach",
    notes: { Yoğurt: "to serve" },
    steps: [
      "Wash the spinach and chop roughly.",
      "Soften the onion in olive oil, add the spinach and cook until wilted.",
      "Make wells in the spinach and crack in the eggs.",
      "Cook covered and serve with yoghurt.",
    ],
  },
  "peynirli-omlet": {
    name: "Peynirli omlet (cheese omelette)",
    shortName: "Cheese omelette",
    steps: [
      "Whisk the eggs with a fork until frothy.",
      "Melt the butter in a pan and pour in the eggs.",
      "When the edges set, scatter the cheese and parsley over one half.",
      "Fold in two, cook for one more minute and serve with black pepper.",
    ],
  },
  pisi: {
    name: "Pişi (fried dough)",
    shortName: "Pişi",
    prep: ["Let the pişi dough rise"],
    steps: [
      "Mix the warm milk, yeast and sugar and wait 5 minutes.",
      "Add the flour and salt and knead a soft dough.",
      "Cover and leave to rise for an hour.",
      "Take small balls of dough, flatten them by hand and poke a hole in the middle.",
      "Fry both sides in hot oil and serve warm.",
    ],
  },
  sutlac: {
    name: "Sütlaç (rice pudding)",
    shortName: "Rice pudding",
    steps: [
      "Simmer the rice in a cup of water until soft.",
      "Add the milk and bring to the boil.",
      "Loosen the rice flour in half a cup of cold milk and add it to the pot.",
      "Add the sugar and cook over low heat for 20 minutes, stirring all the time.",
      "Stir in the vanilla, pour into bowls and serve cold with cinnamon.",
    ],
  },
  "irmik-helvasi": {
    name: "İrmik helvası (semolina halva)",
    shortName: "Semolina halva",
    steps: [
      "Heat the milk, a cup of water and the sugar in a separate pot.",
      "Toast the pine nuts and semolina in butter over low heat until they change colour.",
      "Carefully pour the hot syrup into the semolina and stir.",
      "When the liquid is absorbed, put a towel under the lid and let it rest for 10 minutes.",
    ],
  },
  revani: {
    name: "Revani (semolina cake in syrup)",
    shortName: "Revani",
    prep: ["Boil the syrup and let it cool"],
    steps: [
      "Boil two cups of sugar with 2.5 cups of water and the lemon, then let it cool.",
      "Whisk the eggs and the rest of the sugar until frothy.",
      "Add the yoghurt and oil, then fold in the semolina, flour and baking powder.",
      "Bake in an oiled tray at 180°C for 30–35 minutes.",
      "Pour the cold syrup over the hot cake, let it soak in and cut into squares.",
    ],
  },
  "kabak-tatlisi": {
    name: "Kabak tatlısı (candied pumpkin)",
    shortName: "Pumpkin dessert",
    prep: ["Sugar the pumpkin and let it release its juice"],
    steps: [
      "Peel the pumpkin, cut it into large slices and arrange them in a pot.",
      "Sprinkle over the sugar and leave overnight to release its juice.",
      "Cook covered over low heat for about an hour, until the pumpkin is soft.",
      "Let it cool and serve with walnuts.",
    ],
  },
  muhallebi: {
    name: "Muhallebi (milk pudding)",
    shortName: "Muhallebi",
    steps: [
      "Set aside a glass of the milk and loosen the rice flour and cornflour in it.",
      "Bring the rest of the milk to the boil with the sugar.",
      "Add the loosened mixture and cook, stirring all the time, until thick.",
      "Stir in the vanilla, pour into bowls and chill; serve with cinnamon.",
    ],
  },
};
