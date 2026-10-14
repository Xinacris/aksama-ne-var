import type { EnRecipe } from "./types";

/** Salads and meze. A "cup" is the Turkish su bardağı (200 ml). */
export const salataEn: Record<string, EnRecipe> = {
  cacik: {
    name: "Cacık (cucumber and yoghurt)",
    shortName: "Cacık",
    steps: [
      "Dice the cucumbers small or grate them.",
      "Whisk the yoghurt with crushed garlic, salt and half a cup of cold water.",
      "Stir in the cucumber.",
      "Sprinkle with mint, drizzle with olive oil and serve cold.",
    ],
  },
  "coban-salata": {
    name: "Çoban salata (shepherd’s salad)",
    shortName: "Shepherd’s salad",
    steps: [
      "Dice the tomatoes, cucumbers and peppers small.",
      "Chop the onion finely and rub it with salt to take the edge off.",
      "Chop the parsley finely.",
      "Toss everything with lemon juice, olive oil and salt and serve straight away.",
    ],
  },
  piyaz: {
    name: "Piyaz (white bean salad)",
    shortName: "Piyaz",
    notes: { Yumurta: "boiled" },
    prep: ["Put the beans to soak"],
    steps: [
      "Boil the soaked beans until soft and let them cool.",
      "Slice the onion into half-moons and rub it with sumac and salt.",
      "Mix the beans, onion, chopped parsley and diced tomato.",
      "Dress with vinegar, lemon juice and olive oil.",
      "Top with quartered boiled eggs and serve.",
    ],
  },
  gavurdagi: {
    name: "Gavurdağı (tomato and walnut salad)",
    shortName: "Gavurdağı",
    steps: [
      "Chop the tomatoes, peppers and onion very small.",
      "Roughly crush the walnuts and chop the parsley.",
      "Combine everything in a bowl.",
      "Dress with pomegranate molasses, olive oil, sumac, chilli flakes and salt.",
    ],
  },
  haydari: {
    name: "Haydari (thick yoghurt dip)",
    shortName: "Haydari",
    steps: [
      "Mash the cheese with a fork and mix it with the yoghurt.",
      "Add crushed garlic and finely chopped dill.",
      "Spoon into a bowl and drizzle with mint and olive oil.",
      "Rest in the fridge for half an hour before serving.",
    ],
  },
  tursu: {
    name: "Turşu (pickled vegetables)",
    shortName: "Pickles",
    timeNote: "20 min · waits 10 days",
    steps: [
      "Wash the jars with hot water and let them dry.",
      "Wash the vegetables; prick the peppers with a fork and cut the carrots into sticks.",
      "Pack the vegetables tightly into the jars with garlic and lemon slices.",
      "Mix the vinegar, salt and boiled, cooled water and pour it in to cover completely.",
      "Close the jars and leave them in a cool place for at least 10 days.",
    ],
  },
  "mevsim-salata": {
    name: "Mevsim salata (seasonal green salad)",
    shortName: "Green salad",
    steps: [
      "Wash and dry the lettuce and rocket well, then shred finely.",
      "Grate the carrot and chop the spring onion.",
      "Make a dressing with lemon, pomegranate molasses, olive oil and salt.",
      "Toss with the dressing just before serving.",
    ],
  },
  kisir: {
    name: "Kısır (bulgur salad)",
    shortName: "Kısır",
    steps: [
      "Pour 1.5 cups of boiling water over the bulgur, cover and leave for 15 minutes.",
      "Add the pastes and olive oil and knead well with your hands.",
      "Add the finely chopped herbs and the diced tomato.",
      "Season with lemon, pomegranate molasses, cumin and salt.",
      "Serve with lettuce leaves.",
    ],
  },
  "patlican-salatasi": {
    name: "Patlıcan salatası (smoky aubergine salad)",
    shortName: "Aubergine salad",
    steps: [
      "Char the aubergines over a flame or in the oven until the skins blacken.",
      "Peel them and let the bitter juices drain.",
      "Chop finely with a knife.",
      "Mix with garlic, lemon, olive oil, salt and parsley.",
    ],
  },
  "rus-salatasi": {
    name: "Rus salatası (Russian salad)",
    shortName: "Russian salad",
    steps: [
      "Boil the potatoes, carrots and peas separately and let them cool.",
      "Dice the potatoes, carrots and gherkins small.",
      "Mix the mayonnaise and yoghurt.",
      "Fold the vegetables into the dressing and chill.",
    ],
  },
  "acili-ezme": {
    name: "Acılı ezme (spicy tomato dip)",
    shortName: "Acılı ezme",
    steps: [
      "Peel and deseed the tomatoes.",
      "Chop all the vegetables and the parsley very finely with a knife.",
      "Add the pepper paste, pomegranate molasses, chilli flakes, olive oil and salt.",
      "Chop everything together for a few more minutes until it comes together.",
    ],
  },
  "yogurtlu-semizotu": {
    name: "Yoğurtlu semizotu (purslane with yoghurt)",
    shortName: "Purslane salad",
    steps: [
      "Pick the purslane off its thick stems, wash and pat dry.",
      "Whisk the yoghurt with crushed garlic and salt.",
      "Stir in the purslane.",
      "Drizzle with olive oil and serve.",
    ],
  },
  "havuc-tarator": {
    name: "Havuç tarator (carrot and yoghurt dip)",
    shortName: "Carrot tarator",
    steps: [
      "Grate the carrots.",
      "Sauté them in olive oil for 5 minutes until darker and soft, then let them cool.",
      "Whisk the yoghurt with garlic and salt and add the carrot.",
      "Serve with crushed walnuts.",
    ],
  },
  saksuka: {
    name: "Şakşuka (fried vegetables in tomato sauce)",
    shortName: "Şakşuka",
    steps: [
      "Dice the aubergine, courgette, potato and pepper and fry each separately.",
      "Cook a thick sauce from grated tomato and garlic and season with salt.",
      "Put the fried vegetables on a plate.",
      "Pour the sauce over and serve warm or cold.",
    ],
  },
  "mercimek-koftesi": {
    name: "Mercimek köftesi (red lentil and bulgur patties)",
    shortName: "Lentil köfte",
    notes: { Marul: "to serve" },
    steps: [
      "Cook the lentils in 2.5 cups of water until they fall apart.",
      "Take off the heat, add the bulgur, cover and leave for 20 minutes to swell.",
      "Fry the onion in olive oil, add the pastes and fold it into the mixture.",
      "Add the spices, spring onion and parsley and knead well.",
      "Squeeze into patties in your hand and serve with lettuce and lemon.",
    ],
  },
};
